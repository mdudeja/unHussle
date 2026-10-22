import {
  and,
  eq,
  ExtractTablesWithRelations,
  inArray,
  like,
  notInArray,
} from 'drizzle-orm'
import { SQLiteTransaction } from 'drizzle-orm/sqlite-core'
import { TagInput, UrlInput } from '@c/types/index'
import * as schema from '../schemas'
import { tags, urls, junctionTags, junctionUrls } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'

// Nested `with` configs for relations that go through a junction table
export const withTags = { with: { tag: true } } as const
export const withUrls = { with: { url: true } } as const
export const withTimeEntries = { with: { timeEntry: true } } as const

// Junction relation key -> property on the join row holding the referenced record
const junctionRefs = {
  tags: 'tag',
  urls: 'url',
  timeEntries: 'timeEntry',
} as const
type JunctionRefs = typeof junctionRefs

type Unwrapped<T> = {
  [K in keyof T]: K extends keyof JunctionRefs
    ? T[K] extends readonly (infer Row)[]
      ? Row extends { [P in JunctionRefs[K]]: infer Ref }
        ? Ref[]
        : T[K]
      : T[K]
    : T[K]
}

// Junction relations come back as join rows; unwrap to the referenced records
export const unwrapJunctions = <T extends object>(entity: T): Unwrapped<T> => {
  const result = { ...entity } as Record<string, unknown>
  for (const [key, ref] of Object.entries(junctionRefs)) {
    const rows = result[key]
    if (Array.isArray(rows)) {
      result[key] = rows.map((row) => row[ref])
    }
  }
  return result as Unwrapped<T>
}

// Subquery of ids of any entity attached to a tag whose title matches `pattern`.
// Left un-awaited so it embeds as `IN (SELECT ...)` in the caller's query.
export const taggedIds = (db: NonNullable<UnHussleDB['db']>, pattern: string) =>
  db
    .select({ id: junctionTags.attachedToId })
    .from(junctionTags)
    .innerJoin(tags, eq(junctionTags.refId, tags.id))
    .where(like(tags.title, pattern))

export const toUrlParts = (url: string) => {
  const parsed = new URL(url)
  return {
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    port: parsed.port,
    pathname: parsed.pathname,
    search: parsed.search,
    hash: parsed.hash,
  }
}

// Same normalization as hashtag parsing and tag search: no `#`, lowercase
export const normalizeTagTitle = (title: string) =>
  title.trim().replace(/^#/, '').toLowerCase()

// bun-sqlite transactions are synchronous: only .run()/.all()/.get() inside
export type SyncTx = SQLiteTransaction<
  'sync',
  void,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>

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
