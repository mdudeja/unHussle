import { inArray } from 'drizzle-orm'
import { junctionTags, junctionUrls } from '@d/database/schemas'
import type { SyncTx } from '@d/database/repositories/helpers'
import type { EntityKind } from '@c/workflows/contracts'

export { syncAttachments } from './syncAttachments'

/** Capabilities are composed per entity rather than inherited by repositories. */
export const attachmentCapabilities: Partial<
  Record<EntityKind, { tags: boolean; urls: boolean }>
> = {
  tasks: { tags: true, urls: true },
  projects: { tags: true, urls: true },
  areas: { tags: true, urls: true },
  goals: { tags: true, urls: true },
}

export function removeOwnerAttachments(tx: SyncTx, ids: string[]) {
  if (!ids.length) return
  tx.delete(junctionTags).where(inArray(junctionTags.attachedToId, ids)).run()
  tx.delete(junctionUrls).where(inArray(junctionUrls.attachedToId, ids)).run()
}

export function removeReferenceAttachments(
  tx: SyncTx,
  kind: EntityKind,
  ids: string[],
) {
  if (!ids.length) return
  if (kind === 'tags')
    tx.delete(junctionTags).where(inArray(junctionTags.refId, ids)).run()
  if (kind === 'urls')
    tx.delete(junctionUrls).where(inArray(junctionUrls.refId, ids)).run()
}
