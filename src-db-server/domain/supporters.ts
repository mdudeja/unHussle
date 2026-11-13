import { and, eq, inArray, notInArray } from 'drizzle-orm'
import {
  junctionTags,
  junctionUrls,
  junctionTimeEntries,
  junctionResources,
  tags,
  timeEntries,
  urls,
} from '@d/database/schemas'
import { toUrlParts, type SyncTx } from '@d/database/repositories/helpers'
import type {
  EntitySupporterKind,
  EntryKind,
  MutationInput,
} from '@c/workflows/contracts'
import type {
  SupportersInput,
  TagInput,
  TimeEntryInput,
  UrlInput,
} from '@c/types'

/** Normalizes a tag title into a consistent form for reliable comparison and storage. */
export const normalizeTagTitle = (title: string) =>
  title.trim().replace(/^#/, '').toLowerCase()

/** Capabilities are composed per entity rather than inherited by repositories. */
export const supporterCapabilities: Partial<
  Record<EntryKind, { [K in keyof SupportersInput]: boolean }>
> = {
  tasks: { tags: true, urls: true, time_entries: true, resources: true },
  projects: { tags: true, urls: true, time_entries: false, resources: true },
  areas: { tags: true, urls: true, time_entries: false, resources: true },
  goals: { tags: true, urls: true, time_entries: false, resources: true },
  resources: { tags: true, urls: false, time_entries: false, resources: false },
}

/** Removes supporter junction records associated with the specified entities. */
export function removeEntityOwnedSupporterJunctions(tx: SyncTx, ids: string[]) {
  if (!ids.length) return
  tx.delete(junctionTags).where(inArray(junctionTags.attachedToId, ids)).run()
  tx.delete(junctionUrls).where(inArray(junctionUrls.attachedToId, ids)).run()
  tx.delete(junctionTimeEntries)
    .where(inArray(junctionTimeEntries.attachedToId, ids))
    .run()
  tx.delete(junctionResources)
    .where(inArray(junctionResources.attachedToId, ids))
    .run()
}

/** Removes junction records that associate supporter references with entities for the given supporter kind and IDs. */
export function removeReferenceSupporterJunctions(
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

// Creates missing supporters and links them to `attachedToId`. With `replace`,
// links not in the given set are removed (only for keys that are present).
export const syncSupporters = (
  tx: SyncTx,
  attachedToId: string,
  supporters: SupportersInput,
  { replace = false }: { replace?: boolean } = {},
) => {
  if (supporters.tags) {
    const byTitle = new Map<string, TagInput>()
    for (const tag of supporters.tags) {
      const title = normalizeTagTitle(tag.title)
      if (title && !byTitle.has(title)) byTitle.set(title, { ...tag, title })
    }
    const titles = [...byTitle.keys()]

    let ids: string[] = []
    if (titles.length > 0) {
      tx.insert(tags)
        .values(
          [...byTitle.values()].map(({ title, color }) => ({ title, color })),
        )
        .onConflictDoNothing()
        .run()
      ids = tx
        .select({ id: tags.id })
        .from(tags)
        .where(inArray(tags.title, titles))
        .all()
        .map((row) => row.id)
      tx.insert(junctionTags)
        .values(ids.map((refId) => ({ attachedToId, refId })))
        .onConflictDoNothing()
        .run()
    }

    if (replace) {
      tx.delete(junctionTags)
        .where(
          and(
            eq(junctionTags.attachedToId, attachedToId),
            ids.length > 0 ? notInArray(junctionTags.refId, ids) : undefined,
          ),
        )
        .run()
    }
  }

  if (supporters.urls) {
    const byUrl = new Map<string, UrlInput>()
    for (const url of supporters.urls) {
      const key = url.url.trim()
      if (key && !byUrl.has(key)) byUrl.set(key, { ...url, url: key })
    }
    const keys = [...byUrl.keys()]

    let ids: string[] = []
    if (keys.length > 0) {
      tx.insert(urls)
        .values(
          [...byUrl.values()].map(({ url, title }) => ({
            url,
            title,
            parts: toUrlParts(url),
          })),
        )
        .onConflictDoNothing()
        .run()
      ids = tx
        .select({ id: urls.id })
        .from(urls)
        .where(inArray(urls.url, keys))
        .all()
        .map((row) => row.id)
      tx.insert(junctionUrls)
        .values(ids.map((refId) => ({ attachedToId, refId })))
        .onConflictDoNothing()
        .run()
    }

    if (replace) {
      tx.delete(junctionUrls)
        .where(
          and(
            eq(junctionUrls.attachedToId, attachedToId),
            ids.length > 0 ? notInArray(junctionUrls.refId, ids) : undefined,
          ),
        )
        .run()
    }
  }

  if (supporters.time_entries) {
    const byTaskId = new Map<string, TimeEntryInput[]>()
    const byStartTime = new Map<number, TimeEntryInput[]>()
    for (const entry of supporters.time_entries) {
      const taskId = entry.task_id.trim()
      if (taskId && !byTaskId.has(taskId)) byTaskId.set(taskId, [])
      if (!byStartTime.has(entry.start_time))
        byStartTime.set(entry.start_time, [])
      byTaskId.get(taskId)?.push(entry)
      byStartTime.get(entry.start_time)?.push(entry)
    }

    //deduplicate entries by task_id and start_time
    for (const [taskId, entries] of byTaskId.entries()) {
      const dedupedEntries = Array.from(
        new Set(entries.map((entry) => entry.start_time)),
      ).map((start_time) =>
        entries.find((entry) => entry.start_time === start_time)!,
      )
      byTaskId.set(taskId, dedupedEntries)
    }

    const taskIds = [...byTaskId.keys()]
    const startTimes = [...byStartTime.keys()]
    let ids: string[] = []

    if (taskIds.length > 0) {
      tx.insert(timeEntries)
        .values(
          [...byTaskId.entries()].flatMap(([task_id, entries]) =>
            entries.map((entry) => ({ ...entry, task_id })),
          ),
        )
        .onConflictDoNothing()
        .run()
      ids = tx
        .select({ id: timeEntries.id })
        .from(timeEntries)
        .where(
          and(
            inArray(timeEntries.task_id, taskIds),
            inArray(timeEntries.start_time, startTimes),
          ),
        )
        .all()
        .map((row) => row.id)
      tx.insert(junctionTimeEntries)
        .values(ids.map((refId) => ({ attachedToId, refId })))
        .onConflictDoNothing()
        .run()
    }

    if (replace) {
      tx.delete(junctionTimeEntries)
        .where(
          and(
            eq(junctionTimeEntries.attachedToId, attachedToId),
            ids.length > 0
              ? notInArray(junctionTimeEntries.refId, ids)
              : undefined,
          ),
        )
        .run()
    }
  }
}

/** Applies supported changes to supporter data, including tags, URLs, and time entries, based on the supporter kind and action. */
export function updateSupporters(tx: SyncTx, input: MutationInput) {
  if (!input.id) throw new Error('Invalid input for updateSupporters action')
  const { kind, action, id, changes = {} } = input
  const { tags, urls, time_entries } = changes
  const capability = supporterCapabilities[kind]

  if (
    (tags !== undefined && !capability?.tags) ||
    (urls !== undefined && !capability?.urls) ||
    (time_entries !== undefined && !capability?.time_entries)
  ) {
    throw new Error(`Provided Supporters are not supported for ${kind}`)
  }

  if (!capability) return

  let updatedTags = tags as TagInput[] | undefined
  if (tags && capability.tags && changes.color) {
    updatedTags = (tags as TagInput[]).map(
      (tag) =>
        ({
          ...tag,
          color: tag.color ?? changes.color,
        }) as TagInput,
    )
  }

  syncSupporters(
    tx,
    id,
    {
      tags: updatedTags,
      urls: urls as UrlInput[] | undefined,
      time_entries: time_entries as TimeEntryInput[] | undefined,
    },
    { replace: action === 'update' },
  )
}

/** Deletes supporter junction records that link supporters to entities or collections, either by their owning entities or by the supporter references being removed. */
export function deleteSupporterJunctions(tx: SyncTx, input: MutationInput) {
  if (!input || (!input.ids && !input.attachedIds)) {
    throw new Error('Invalid input for deleteJunctions action')
  }

  if (input.ids && !Array.isArray(input.ids)) {
    throw new Error('Input ids must be an array for deleteJunctions action')
  }

  if (input.attachedIds && !Array.isArray(input.attachedIds)) {
    throw new Error(
      'Input attachedIds must be an array for deleteJunctions action',
    )
  }

  // `attachedIds` match junction `attachedToId` (owning entities / collections);
  // `ids` match junction `refId` (supporters of `input.kind`).

  if (input.attachedIds) {
    removeEntityOwnedSupporterJunctions(tx, input.attachedIds)
  }

  if (input.ids) {
    removeReferenceSupporterJunctions(
      tx,
      input.kind as EntitySupporterKind,
      input.ids,
    )
  }
}
