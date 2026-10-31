import { ExtractTablesWithRelations, like, eq } from 'drizzle-orm'
import { SQLiteTransaction } from 'drizzle-orm/sqlite-core'
import * as schema from '../schemas'
import { tags, junctionTags } from '../schemas'
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
      result[key] = (rows as Record<string, unknown>[]).map((row) => row[ref])
    }
  }
  return result as Unwrapped<T>
}

// Nested `with` config that loads a linked collection's own members
export const withMembers = { with: { tasks: true, resources: true } } as const

type Members = { tasks?: { id: string }[]; resources?: { id: string }[] }
type WithoutMembers<V> = V extends readonly (infer Row)[]
  ? Omit<Row, keyof Members>[]
  : V extends object
    ? Omit<V, keyof Members>
    : V

type Merged<T, K extends keyof T> = Omit<T, K> & {
  [P in K]: WithoutMembers<T[P]>
}

const byId = <T extends { id: string }>(rows: T[]) => [
  ...new Map(rows.map((row) => [row.id, row])).values(),
]

const withoutMembers = (row: Members) => {
  const { tasks: _tasks, resources: _resources, ...rest } = row
  return rest
}

// Folds the tasks and resources of linked collections (loaded with
// `withMembers`) into the entity's own lists, de-duplicated by id, and strips
// them from the collection rows so they keep their base shape.
export const mergeCollectionMembers = <
  T extends Members,
  K extends keyof T & string,
>(
  entity: T,
  collections: K[],
): Merged<T, K> => {
  const result = { ...entity } as Record<string, unknown>
  const tasks = [...(entity.tasks ?? [])]
  const resources = [...(entity.resources ?? [])]

  for (const key of collections) {
    const value = entity[key] as Members | Members[] | null | undefined
    if (!value) continue
    const rows = Array.isArray(value) ? value : [value]
    for (const row of rows) {
      tasks.push(...(row.tasks ?? []))
      resources.push(...(row.resources ?? []))
    }
    result[key] = Array.isArray(value)
      ? value.map(withoutMembers)
      : withoutMembers(value)
  }

  result.tasks = byId(tasks)
  result.resources = byId(resources)
  return result as Merged<T, K>
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

// bun-sqlite transactions are synchronous: only .run()/.all()/.get() inside
export type SyncTx = SQLiteTransaction<
  'sync',
  void,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>
