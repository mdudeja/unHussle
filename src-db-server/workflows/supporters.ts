import { inArray } from 'drizzle-orm'
import {
  junctionTags,
  junctionUrls,
  junctionTimeEntries,
} from '@d/database/schemas'
import type { SyncTx } from '@d/database/repositories/helpers'
import type { EntitySupporterKind, EntryKind } from '@c/workflows/contracts'
import { SupportersInput } from '@c/types'

export { syncSupporters } from './syncSupporters'

/** Capabilities are composed per entity rather than inherited by repositories. */
export const supporterCapabilities: Partial<
  Record<EntryKind, { [K in keyof SupportersInput]: boolean }>
> = {
  tasks: { tags: true, urls: true, time_entries: true },
  projects: { tags: true, urls: true, time_entries: false },
  areas: { tags: true, urls: true, time_entries: false },
  goals: { tags: true, urls: true, time_entries: false },
}

export function removeOwnerSupporters(tx: SyncTx, ids: string[]) {
  if (!ids.length) return
  tx.delete(junctionTags).where(inArray(junctionTags.attachedToId, ids)).run()
  tx.delete(junctionUrls).where(inArray(junctionUrls.attachedToId, ids)).run()
  tx.delete(junctionTimeEntries)
    .where(inArray(junctionTimeEntries.attachedToId, ids))
    .run()
}

export function removeReferenceSupporters(
  tx: SyncTx,
  kind: EntitySupporterKind,
  ids: string[],
) {
  if (!ids.length) return
  if (kind === 'tags')
    tx.delete(junctionTags).where(inArray(junctionTags.refId, ids)).run()
  if (kind === 'urls')
    tx.delete(junctionUrls).where(inArray(junctionUrls.refId, ids)).run()
  if (kind === 'time_entries')
    tx.delete(junctionTimeEntries)
      .where(inArray(junctionTimeEntries.refId, ids))
      .run()
}
