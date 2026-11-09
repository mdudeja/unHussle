import { ExtractTablesWithRelations, like, eq, desc } from 'drizzle-orm'
import { SQLiteTransaction } from 'drizzle-orm/sqlite-core'
import * as schema from '../schemas'
import {
  tags,
  junctionTags,
  junctionUrls,
  junctionTimeEntries,
  junctionResources,
} from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import type { ResourceLink } from '@c/types/Hydrated'

// Nested `with` configs for relations that go through a junction table.
// The referenced row is a `one` relation, which takes no `orderBy`: order the
// junction rows by `refId` (the referenced id) instead.
export const withTags = {
  orderBy: junctionTags.refId,
  with: { tag: true },
} as const
export const withUrls = {
  orderBy: junctionUrls.refId,
  with: { url: true },
} as const
export const withTimeEntries = {
  orderBy: desc(junctionTimeEntries.refId),
  with: { timeEntry: true },
} as const
export const withResources = {
  orderBy: junctionResources.refId,
  with: { resource: true },
} as const
// A resource's links, with whichever owner each junction row points at
export const withResourceLinks = {
  with: { task: true, project: true, area: true, goal: true },
} as const

// Junction relation key -> property on the join row holding the referenced record
const junctionRefs = {
  tags: 'tag',
  urls: 'url',
  timeEntries: 'timeEntry',
  resources: 'resource',
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

// Nested `with` config that loads a linked collection's own tasks.
// Resources stay direct-only: forms are filled from these rows, so merged
// resources would be saved as direct links.
export const withMembers = { with: { tasks: true } } as const

type Members = { tasks?: { id: string }[] }
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
  const { tasks: _tasks, ...rest } = row
  return rest
}

// Folds the tasks of linked collections (loaded with `withMembers`) into the
// entity's own list, de-duplicated by id, and strips them from the collection
// rows so they keep their base shape.
export const mergeCollectionMembers = <
  T extends Members,
  K extends keyof T & string,
>(
  entity: T,
  collections: K[],
): Merged<T, K> => {
  const result = { ...entity } as Record<string, unknown>
  const tasks = [...(entity.tasks ?? [])]

  for (const key of collections) {
    const value = entity[key] as Members | Members[] | null | undefined
    if (!value) continue
    const rows = Array.isArray(value) ? value : [value]
    for (const row of rows) {
      tasks.push(...(row.tasks ?? []))
    }
    result[key] = Array.isArray(value)
      ? value.map(withoutMembers)
      : withoutMembers(value)
  }

  result.tasks = byId(tasks)
  return result as Merged<T, K>
}

type ResourceLinkRow = {
  task?: { id: string; title: string } | null
  project?: { id: string; title: string } | null
  area?: { id: string; title: string } | null
  goal?: { id: string; title: string } | null
}

// A resource's junction rows each point at one owner; keep the one that resolved.
export const toResourceLinks = (rows: ResourceLinkRow[] = []): ResourceLink[] =>
  rows.flatMap((row) => {
    const owners = [
      ['tasks', row.task],
      ['projects', row.project],
      ['areas', row.area],
      ['goals', row.goal],
    ] as const
    return owners
      .filter(([, owner]) => owner)
      .map(([kind, owner]) => ({ kind, id: owner!.id, title: owner!.title }))
  })

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
