import { useStore } from '@/store'
import { getFrontendRuntime, type FrontendRuntime } from '@/workflows/runtime'
import type { EntryKind, EntryRecord } from '@c/workflows/contracts'
import type { EntityRead } from '@/workflows/services'

/** Integration tests read persisted data through the query owner, never Zustand. */
export const readList = async <K extends EntryKind>(kind: K) =>
  getFrontendRuntime(useStore).fetchList(kind) as Promise<EntityRead<K>[]>

/** Searches for entries of a specified kind that match a given search term. */
export const searchEntries = async <K extends EntryKind>(
  kind: K,
  term: string,
) => getFrontendRuntime(useStore).search(kind, term) as Promise<EntityRead<K>[]>

/** Retrieves up-to-date detail data for an entry, ensuring any cached result
 * is refreshed before loading. */
export const readDetail = async <K extends EntryKind>(kind: K, id: string) => {
  const runtime = getFrontendRuntime(useStore)
  const key = runtime.defineDetail(kind, id)
  runtime.queries.markStale(key)
  return runtime.queries.ensure<EntityRead<K>>(key)
}

/** Retrieves the current rows for a given entry kind, returning an empty list
 * when none are available. */
export const queryRows = (runtime: FrontendRuntime, kind: EntryKind) =>
  runtime.queries.snapshot<EntryRecord[]>(runtime.defineList(kind)).data ?? []
