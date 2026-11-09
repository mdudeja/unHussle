import { existsSync, rmSync } from 'node:fs'
import { posix } from 'node:path'
import { eq, inArray } from 'drizzle-orm'
import { resources } from '@d/database/schemas'
import type { SyncTx } from '@d/database/repositories/helpers'
import type { MutationInput } from '@c/workflows/contracts'
import {
  hashContent,
  moveFile,
  resolveIn,
  trashFile,
  uniquePath,
  writeNew,
  type Vault,
} from '@d/vault/vault'

type FileContext = {
  vault: Vault
  now: () => number
  compensate: (undo: () => void) => void
}

/** Gives a row without a file a new empty one at a free path. */
export function createResourceFile(
  tx: SyncTx,
  root: string,
  row: { id: string; title: string },
  compensate: FileContext['compensate'],
) {
  const rel = uniquePath(tx, root, row.title, { exceptId: row.id })
  const abs = resolveIn(root, rel)
  writeNew(abs, '')
  compensate(() => rmSync(abs, { force: true }))
  tx.update(resources)
    .set({ file_path: rel, content_hash: hashContent('') })
    .where(eq(resources.id, row.id))
    .run()
  return rel
}

/**
 * Keeps a resource's file in step with its row: a new row gets an empty file,
 * and a title change renames the file within its folder.
 */
export function syncResourceFile(
  tx: SyncTx,
  { kind, action, id, changes = {} }: MutationInput,
  { vault, compensate }: FileContext,
) {
  if (kind !== 'resources' || !id) return
  if (action !== 'create' && action !== 'update') return
  const row = tx.select().from(resources).where(eq(resources.id, id)).get()
  if (!row) return
  const root = vault.root(tx)

  if (!row.file_path) {
    createResourceFile(tx, root, row, compensate)
    return
  }
  if (action !== 'update' || !('title' in changes)) return

  const dir = posix.dirname(row.file_path)
  const rel = uniquePath(tx, root, row.title, {
    dir: dir === '.' ? '' : dir,
    exceptId: id,
  })
  if (rel === row.file_path) return

  const from = resolveIn(root, row.file_path)
  const to = resolveIn(root, rel)
  if (existsSync(from)) {
    moveFile(from, to)
    compensate(() => moveFile(to, from))
  }
  tx.update(resources).set({ file_path: rel }).where(eq(resources.id, id)).run()
}

/** Moves the files of resources about to be deleted into `.trash`. */
export function trashResourceFiles(
  tx: SyncTx,
  { kind, action, id }: MutationInput,
  { vault, now, compensate }: FileContext,
) {
  if (kind !== 'resources') return
  const rows = tx
    .select({ file_path: resources.file_path })
    .from(resources)
    .where(
      action === 'deleteAll' || !id ? undefined : inArray(resources.id, [id]),
    )
    .all()
  const root = vault.root(tx)
  const at = now()

  for (const { file_path } of rows) {
    if (!file_path) continue
    const abs = resolveIn(root, file_path)
    if (!existsSync(abs)) continue
    const trashed = trashFile(root, abs, at)
    compensate(() => moveFile(trashed, abs))
  }
}
