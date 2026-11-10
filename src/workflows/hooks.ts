import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useStore as useZustandStore } from 'zustand'
import { useStore } from '@/store'
import type { EntryKind } from '@c/workflows/contracts'
import { Logger } from '@c/Logger'
import { getFrontendRuntime, dependencies } from '@/bootstrap'
import { fetchLimits, type EntityRead } from './services'
import type { QueryDefinition } from './queries'
import { fetchTaskContext } from '@/services/taskContext'

/** Provides access to the workflow runtime associated with the current store. */
export const useWorkflowRuntime = () => getFrontendRuntime(useStore)

/** Provides reactive access to a workflow query’s state while ensuring the query is loaded and kept available for use. */
export function useWorkflowQuery<T>(
  definition: QueryDefinition<T>,
  enabled = true,
  /** Reload on every mount instead of reusing cached data. */
  { refetchOnMount = false }: { refetchOnMount?: boolean } = {},
) {
  const { queries } = useWorkflowRuntime()
  const isDBReady = useStore((state) => state.isDBReady)
  queries.define(definition)
  const { key } = definition

  const subscribe = useCallback(
    (notify: () => void) => queries.store.subscribe(notify),
    [queries],
  )

  const snapshot = useCallback(() => queries.snapshot<T>(key), [queries, key])

  const state = useSyncExternalStore(subscribe, snapshot, snapshot)

  useEffect(() => {
    if (!enabled) return
    const deactivate = queries.activate(key)
    if (refetchOnMount) queries.markStale(key)
    queries
      .ensure(key)
      .catch((error) =>
        Logger.getInstance().error(`Failed to load ${key}`, { error }),
      )
    return deactivate
  }, [queries, key, enabled, isDBReady, refetchOnMount])

  return {
    ...state,
    isLoading:
      enabled &&
      (state.isLoading || (state.data === null && state.error === null)),
  }
}

/** Fetches paginated entries of a specified kind and keeps shared workflow entry state up to date. */
export function useEntryList<K extends EntryKind>(
  kind: K,
  page = 1,
  enabled = true,
) {
  const runtime = useWorkflowRuntime()
  return useWorkflowQuery<EntityRead<K>[]>(
    {
      key: `list:${kind}:${page}`,
      dependencies: dependencies(kind),
      load: () =>
        runtime.services[kind].fetchPaginated(
          page,
          fetchLimits[kind],
        ) as Promise<EntityRead<K>[]>,
    },
    enabled,
  )
}

/** Retrieves and exposes the detailed data for a specific entry identified by its kind and ID. */
export function useEntryDetail(kind: EntryKind, id: string, enabled = true) {
  const runtime = useWorkflowRuntime()
  return useWorkflowQuery(
    {
      key: `detail:${kind}:${id}`,
      dependencies: dependencies(kind),
      load: () => runtime.services[kind].fetchById(id),
    },
    enabled && Boolean(id),
  )
}

/** Searches entries of a specified kind by a term and returns the matching results, retaining the most recent results for that kind while a new search is pending. */
export function useEntrySearch<T extends { id: string }>(
  kind: EntryKind,
  term: string,
) {
  const runtime = useWorkflowRuntime()
  const key = `search:${kind}:${term}`
  const query = useWorkflowQuery(
    {
      key,
      dependencies: dependencies(kind),
      load: () =>
        runtime.services[kind].search(term) as unknown as Promise<T[]>,
    },
    Boolean(term),
  )

  // Remember a cache key for pending-search presentation, never a second copy
  // of server rows. The coordinator remains the owner of both result sets.
  const [previous, setPrevious] = useState<{
    kind: EntryKind
    key: string
  } | null>(null)
  if (query.data !== null && (previous?.key !== key || previous.kind !== kind))
    setPrevious({ kind, key })
  return {
    ...query,
    data:
      query.data ??
      (previous?.kind === kind
        ? runtime.queries.snapshot<T[]>(previous.key).data
        : null),
  }
}

/** A resource's markdown, read from the vault each time it is opened. */
export function useResourceContent(id: string) {
  const runtime = useWorkflowRuntime()
  return useWorkflowQuery(
    {
      key: `content:resources:${id}`,
      dependencies: ['resourceContent'],
      load: () => runtime.vault.content(id),
    },
    Boolean(id),
    { refetchOnMount: true },
  )
}

/** What a task brings along: its own and its ancestors' resources, links and tags. */
export function useTaskContext(taskId: string, enabled = true) {
  return useWorkflowQuery(
    {
      key: `context:tasks:${taskId}`,
      dependencies: dependencies('tasks'),
      load: () => fetchTaskContext(taskId),
    },
    enabled && Boolean(taskId),
  )
}

/** Provides access to information about the current vault. */
export function useVaultInfo() {
  const runtime = useWorkflowRuntime()
  return useWorkflowQuery({
    key: 'vault:info',
    dependencies: ['vault', 'resources'],
    load: () => runtime.vault.info(),
  })
}

/** Retrieves the current tracking session from the workflow runtime UI state. */
export function useTrackingSession() {
  return useZustandStore(useWorkflowRuntime().ui, (state) => state.tracking)
}
