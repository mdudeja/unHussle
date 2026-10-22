import { eq, like } from 'drizzle-orm'
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
