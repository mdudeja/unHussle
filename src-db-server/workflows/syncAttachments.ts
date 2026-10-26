import { and, eq, inArray, notInArray } from 'drizzle-orm'
import type { TagInput, UrlInput } from '@c/types'
import { tags, urls, junctionTags, junctionUrls } from '@d/database/schemas'
import { toUrlParts, type SyncTx } from '@d/database/repositories/helpers'

export const normalizeTagTitle = (title: string) =>
  title.trim().replace(/^#/, '').toLowerCase()

type Attachments = { tags?: TagInput[]; urls?: UrlInput[] }

// Creates missing tags/urls and links them to `attachedToId`. With `replace`,
// links not in the given set are removed (only for keys that are present).
export const syncAttachments = (
  tx: SyncTx,
  attachedToId: string,
  attachments: Attachments,
  { replace = false }: { replace?: boolean } = {},
) => {
  if (attachments.tags) {
    const byTitle = new Map<string, TagInput>()
    for (const tag of attachments.tags) {
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

  if (attachments.urls) {
    const byUrl = new Map<string, UrlInput>()
    for (const url of attachments.urls) {
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
}
