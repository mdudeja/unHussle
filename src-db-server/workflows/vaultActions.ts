import {
  cpSync,
  existsSync,
  readdirSync,
  rmSync,
  rmdirSync,
  statSync,
} from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { eq } from 'drizzle-orm'
import { appSettings, resources } from '@d/database/schemas'
import type { SyncTx } from '@d/database/repositories/helpers'
import type { Resource } from '@c/types'
import type { VaultCommands, VaultInfo } from '@c/vault/contracts'
import { slugify } from '@c/slug'
import {
  fileExists,
  hashContent,
  listFiles,
  readFile,
  resolveIn,
  titleFromFile,
  uniquePath,
  VaultConflict,
  VaultError,
  writeAtomic,
  writeNew,
  type Vault,
} from '@d/vault/vault'

export type VaultCommand = keyof VaultCommands

type Request = {
  [K in VaultCommand]: { command: K; input: VaultCommands[K]['input'] }
}[VaultCommand]

export type VaultState = Request & {
  now: number
  vault: Vault
  root: string
  compensate: (undo: () => void) => void
  afterCommit: (run: () => void) => void
  resource?: Resource['Read']
  /** Vault files not stored on any row. */
  unindexed?: Set<string>
  repaired?: number
  missing?: string[]
  result?: VaultCommands[VaultCommand]['result']
  /** Set by an action that has produced the final result early. */
  done?: boolean
}

export type VaultActionName =
  | 'loadResource'
  | 'checkContentBase'
  | 'writeContent'
  | 'listVaultFiles'
  | 'repairMissing'
  | 'importUnindexed'
  | 'validateVaultTarget'
  | 'copyVault'
  | 'saveVaultSetting'

/** Synchronous; runs inside the command's transaction. */
export type VaultAction = (
  name: VaultActionName,
  state: VaultState,
  work: { tx: SyncTx },
) => void

function inputOf<K extends VaultCommand>(state: VaultState, command: K) {
  if (state.command !== command)
    throw new Error(`${state.command} is not ${command}`)
  return state.input as VaultCommands[K]['input']
}

function loadedResource(state: VaultState) {
  if (!state.resource)
    throw new Error('loadResource must run before this action')
  return state.resource
}

/** Counts for the vault page; `missing` checks every stored path on disk. */
export function vaultInfo(db: Pick<SyncTx, 'select'>, vault: Vault): VaultInfo {
  const { path, source } = vault.rootOf(db)
  const rows = db
    .select({ file_path: resources.file_path })
    .from(resources)
    .all()
  return {
    path,
    source,
    resources: rows.length,
    missing: rows.filter((row) => !fileExists(path, row.file_path)).length,
  }
}

const isInside = (parent: string, child: string) => {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

export const vaultActions: { [K in VaultActionName]?: VaultAction } = {
  loadResource: (_name, state, { tx }) => {
    const { id } = inputOf(state, 'resource.content.save')
    const row = tx.select().from(resources).where(eq(resources.id, id)).get()
    if (!row) throw new Error('NOT_FOUND')
    state.resource = row
  },

  // Content saves name the hash they started from, so an edit made outside
  // the app since then isn't overwritten silently.
  checkContentBase: (_name, state) => {
    const { baseHash, force } = inputOf(state, 'resource.content.save')
    const { file_path } = loadedResource(state)
    if (force || baseHash === undefined || !file_path) return
    const current = fileExists(state.root, file_path)
      ? readFile(resolveIn(state.root, file_path))
      : null
    if ((current?.hash ?? null) !== baseHash)
      throw new VaultConflict(
        'The file changed outside the app. Reload it or overwrite it.',
      )
  },

  // Writes the content; a missing file is recreated (at a new path if needed).
  writeContent: (_name, state, { tx }) => {
    const { content } = inputOf(state, 'resource.content.save')
    const resource = loadedResource(state)
    const rel =
      resource.file_path ??
      uniquePath(tx, state.root, resource.title, { exceptId: resource.id })
    const abs = resolveIn(state.root, rel)
    const previous = readFile(abs)
    writeAtomic(abs, content)
    state.compensate(() =>
      previous
        ? writeAtomic(abs, previous.content)
        : rmSync(abs, { force: true }),
    )

    const content_hash = hashContent(content)
    const row = tx
      .update(resources)
      .set({ file_path: rel, content_hash, updated_at: state.now })
      .where(eq(resources.id, resource.id))
      .returning()
      .get()
    state.result = { id: row.id, content_hash, updated_at: row.updated_at }
  },

  listVaultFiles: (_name, state, { tx }) => {
    const stored = new Set(
      tx
        .select({ file_path: resources.file_path })
        .from(resources)
        .all()
        .flatMap((row) => (row.file_path ? [row.file_path] : [])),
    )
    state.unindexed = new Set(
      listFiles(state.root).filter((rel) => !stored.has(rel)),
    )
  },

  // A row whose file is gone takes an unindexed file named after its title
  // (a rename that didn't commit); a row with no path gets a new empty file.
  repairMissing: (_name, state, { tx }) => {
    const unindexed = state.unindexed ?? new Set<string>()
    state.repaired = 0
    state.missing = []
    for (const row of tx.select().from(resources).all()) {
      if (fileExists(state.root, row.file_path)) continue
      const slug = slugify(row.title)
      const dir = row.file_path?.includes('/')
        ? row.file_path.slice(0, row.file_path.lastIndexOf('/') + 1)
        : ''
      const match = [`${dir}${slug}.md`, `${slug}.md`].find((rel) =>
        unindexed.has(rel),
      )
      if (match) {
        const file = readFile(resolveIn(state.root, match))
        tx.update(resources)
          .set({ file_path: match, content_hash: file?.hash ?? null })
          .where(eq(resources.id, row.id))
          .run()
        unindexed.delete(match)
        state.repaired++
      } else if (!row.file_path) {
        const rel = uniquePath(tx, state.root, row.title, { exceptId: row.id })
        const abs = resolveIn(state.root, rel)
        writeNew(abs, '')
        state.compensate(() => rmSync(abs, { force: true }))
        tx.update(resources)
          .set({ file_path: rel, content_hash: hashContent('') })
          .where(eq(resources.id, row.id))
          .run()
        state.repaired++
      } else {
        state.missing.push(row.title)
      }
    }
  },

  // Each remaining file becomes a resource titled by its first heading.
  importUnindexed: (_name, state, { tx }) => {
    const unindexed = [...(state.unindexed ?? [])]
    const titles = new Set(
      tx
        .select({ title: resources.title })
        .from(resources)
        .all()
        .map((row) => row.title),
    )
    let imported = 0
    for (const rel of unindexed) {
      const file = readFile(resolveIn(state.root, rel))
      if (!file) continue
      const base = titleFromFile(rel, file.content) || 'Untitled'
      let title = base
      for (let n = 2; titles.has(title); n++) title = `${base} (${n})`
      titles.add(title)
      tx.insert(resources)
        .values({ title, file_path: rel, content_hash: file.hash })
        .run()
      imported++
    }
    state.result = {
      imported,
      repaired: state.repaired ?? 0,
      missing: state.missing ?? [],
    }
  },

  // The new folder must be absolute and empty (or not exist yet), and can't
  // contain or sit inside the current vault.
  validateVaultTarget: (_name, state, { tx }) => {
    const { path } = inputOf(state, 'vault.settings.change')
    if (!isAbsolute(path))
      throw new VaultError('Choose an absolute folder path')
    const target = resolve(path)
    const current = resolve(state.root)
    if (target === current) {
      state.result = vaultInfo(tx, state.vault)
      state.done = true
      return
    }
    if (isInside(current, target) || isInside(target, current))
      throw new VaultError(
        "The new folder can't be inside the current vault, or contain it",
      )
    if (existsSync(target)) {
      if (!statSync(target).isDirectory())
        throw new VaultError('The chosen path is not a folder')
      if (readdirSync(target).length > 0)
        throw new VaultError('Choose an empty folder for the vault')
    }
  },

  // Copies rather than renames: the folders may be on different disks.
  copyVault: (_name, state) => {
    const target = resolve(inputOf(state, 'vault.settings.change').path)
    const current = resolve(state.root)
    const existed = existsSync(target)
    const entries = existsSync(current) ? readdirSync(current) : []
    for (const entry of entries)
      cpSync(join(current, entry), join(target, entry), {
        recursive: true,
        errorOnExist: true,
        force: false,
      })
    state.compensate(() => {
      if (!existed) return rmSync(target, { recursive: true, force: true })
      for (const entry of entries)
        rmSync(join(target, entry), { recursive: true, force: true })
    })
    // The old copies go once the new folder is saved; a failure only leaves files behind.
    state.afterCommit(() => {
      for (const entry of entries)
        rmSync(join(current, entry), { recursive: true, force: true })
      try {
        rmdirSync(current)
      } catch {
        // Not empty (something else lives there) or already gone.
      }
    })
  },

  saveVaultSetting: (_name, state, { tx }) => {
    const target = resolve(inputOf(state, 'vault.settings.change').path)
    const saved = tx
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, 'default'))
      .get()?.settings
    const settings = { ...saved, vaultDir: target }
    tx.insert(appSettings)
      .values({ id: 'default', settings })
      .onConflictDoUpdate({ target: appSettings.id, set: { settings } })
      .run()
    state.result = vaultInfo(tx, state.vault)
  },
}
