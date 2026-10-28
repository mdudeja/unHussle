import { and, eq, inArray, notInArray } from 'drizzle-orm'
import type {
  SupportersInput,
  TagInput,
  UrlInput,
  TimeEntryInput,
} from '@c/types'
import {
  tags,
  urls,
  junctionTags,
  junctionUrls,
  timeEntries,
  junctionTimeEntries,
} from '@d/database/schemas'
import { toUrlParts, type SyncTx } from '@d/database/repositories/helpers'

export const normalizeTagTitle = (title: string) =>
  title.trim().replace(/^#/, '').toLowerCase()

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
