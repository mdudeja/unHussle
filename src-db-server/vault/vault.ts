import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import {
  basename,
  dirname,
  extname,
  join,
  posix,
  relative,
  resolve,
  sep,
} from 'node:path'
import { eq } from 'drizzle-orm'
import { appSettings, resources } from '@d/database/schemas'
import type { SyncTx } from '@d/database/repositories/helpers'
import { slugify } from '@c/slug'

/** A request the vault can't carry out (bad path, non-empty target, …). */
export class VaultError extends Error {
  name = 'VaultError'
}

/** The file changed on disk since the client read it. */
export class VaultConflict extends Error {
  name = 'VaultConflict'
}

export const TRASH_DIR = '.trash'

/** Reads settings inside or outside a transaction. */
export type VaultReader = Pick<SyncTx, 'select'>

export type VaultRoot = { path: string; source: 'custom' | 'default' }

/** Generates a deterministic hash of content for identification or integrity verification. */
export const hashContent = (content: string) =>
  createHash('sha256').update(content).digest('hex')

/** Resolves the vault root: the user's setting, else the default folder. */
export function createVault(defaultRoot: string) {
  return {
    defaultRoot,
    /** Returns the vault root to use, preferring the configured custom vault directory and falling back to the default root. */
    rootOf(db: VaultReader): VaultRoot {
      const saved = db
        .select()
        .from(appSettings)
        .where(eq(appSettings.id, 'default'))
        .get()?.settings
      return saved?.vaultDir
        ? { path: saved.vaultDir, source: 'custom' }
        : { path: defaultRoot, source: 'default' }
    },
    /** Returns the path to the root location represented by the vault reader. */
    root(db: VaultReader) {
      return this.rootOf(db).path
    },
  }
}

export type Vault = ReturnType<typeof createVault>

/**
 * `VAULT_DIR`, else a `vault` folder next to the DB file. An in-memory DB
 * gets a temporary vault, so tests never touch a real one.
 */
export function defaultVaultRoot(dbFilePath?: string) {
  if (process.env.VAULT_DIR) return process.env.VAULT_DIR
  if (!dbFilePath || dbFilePath === ':memory:')
    return mkdtempSync(join(tmpdir(), 'unhussle-vault-'))
  return join(dirname(dbFilePath), 'vault')
}

/** Absolute path of a vault-relative markdown file; refuses anything outside the vault. */
export function resolveIn(root: string, rel: string) {
  const base = resolve(root)
  const abs = resolve(base, rel)
  if (!abs.startsWith(base + sep))
    throw new VaultError('Path is outside the vault')
  if (extname(abs).toLowerCase() !== '.md')
    throw new VaultError('Only markdown files are supported')
  if (
    relative(base, abs)
      .split(sep)
      .some((part) => part.startsWith('.'))
  )
    throw new VaultError('Hidden folders are not part of the vault')
  return abs
}

/** Vault-relative path in POSIX form, as stored in `resources.file_path`. */
const toStored = (root: string, abs: string) =>
  relative(resolve(root), abs).split(sep).join('/')

/** Determines whether a file exists at the specified relative path within the given root directory. */
export function fileExists(root: string, rel: string | null) {
  if (!rel) return false
  try {
    return existsSync(resolveIn(root, rel))
  } catch {
    return false
  }
}

/**
 * Free path for a title: `q3-plan.md`, then `q3-plan-2.md`, … A path is taken
 * when another row stores it or an unindexed file already exists there.
 */
export function uniquePath(
  tx: VaultReader,
  root: string,
  title: string,
  { dir = '', exceptId }: { dir?: string; exceptId?: string } = {},
) {
  const base = slugify(title)
  for (let n = 1; ; n++) {
    const name = n === 1 ? `${base}.md` : `${base}-${n}.md`
    const rel = dir ? posix.join(dir, name) : name
    const owner = tx
      .select({ id: resources.id })
      .from(resources)
      .where(eq(resources.file_path, rel))
      .get()
    if (owner) {
      if (owner.id === exceptId) return rel
      continue
    }
    if (existsSync(resolveIn(root, rel))) continue
    return rel
  }
}

/** Reads a file’s contents and computes a hash of them, returning null if the file does not exist. */
export function readFile(abs: string) {
  if (!existsSync(abs)) return null
  const content = readFileSync(abs, 'utf8')
  return { content, hash: hashContent(content) }
}

/** Creates a file; fails if one is already there. */
export function writeNew(abs: string, content: string) {
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, content, { flag: 'wx' })
}

/** Replaces a file's content without leaving a half-written file behind. */
export function writeAtomic(abs: string, content: string) {
  mkdirSync(dirname(abs), { recursive: true })
  const temp = join(dirname(abs), `.${basename(abs)}.${process.pid}.tmp`)
  writeFileSync(temp, content)
  renameSync(temp, abs)
}

/** Renames a file; refuses to overwrite another one. */
export function moveFile(from: string, to: string) {
  if (from === to) return
  // A case-only rename on a case-insensitive disk sees `to` as existing.
  if (from.toLowerCase() === to.toLowerCase()) {
    const temp = `${from}.${process.pid}.rename`
    renameSync(from, temp)
    renameSync(temp, to)
    return
  }
  if (existsSync(to)) throw new VaultError(`A file already exists at ${to}`)
  mkdirSync(dirname(to), { recursive: true })
  renameSync(from, to)
}

/** Moves a file into `.trash`; returns where it went. */
export function trashFile(root: string, abs: string, at: number) {
  const name = basename(abs, extname(abs))
  const trash = join(resolve(root), TRASH_DIR)
  let target = join(trash, `${name}-${at}.md`)
  for (let n = 2; existsSync(target); n++)
    target = join(trash, `${name}-${at}-${n}.md`)
  moveFile(abs, target)
  return target
}

/** Vault-relative paths of every markdown file, skipping hidden folders. */
export function listFiles(root: string): string[] {
  const base = resolve(root)
  if (!existsSync(base)) return []
  const found: string[] = []
  /** Recursively scans a directory tree to find Markdown files while skipping hidden entries. */
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) walk(abs)
      else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md')
        found.push(toStored(base, abs))
    }
  }
  walk(base)
  return found.sort()
}

/** Title for an imported file: its first `# heading`, else its file name. */
export function titleFromFile(rel: string, content: string) {
  const heading = content.match(/^#[ \t]+(.+?)[ \t#]*$/m)?.[1]?.trim()
  if (heading) return heading
  return posix.basename(rel, posix.extname(rel)).replace(/[-_]+/g, ' ').trim()
}
