import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useStore as useZustandStore } from 'zustand'
import { useStore } from '@/store'
import type { EntryKind, EntryRecord } from '@c/workflows/contracts'
import { Logger } from '@c/Logger'
import { getFrontendRuntime, dependencies } from './runtime'
import { fetchLimits } from './services'
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
export function useEntryList(kind: EntryKind, page = 1, enabled = true) {
  const runtime = useWorkflowRuntime()
  return useWorkflowQuery<EntryRecord[]>(
    {
      key: `list:${kind}:${page}`,
      dependencies: dependencies(kind),
      load: () =>
        runtime.services[kind].fetchPaginated(page, fetchLimits[kind]),
      onData: (data) =>
        useStore.setState((state) => ({ [kind]: { ...state[kind], data } })),
    },
    enabled,
  )
}

/** Retrieves and exposes the detailed data for a specific entry identified by its kind and ID. */
export function useEntryDetail(kind: EntryKind, id: string) {
  const runtime = useWorkflowRuntime()
  return useWorkflowQuery({
    key: `detail:${kind}:${id}`,
    dependencies: dependencies(kind),
    load: () => runtime.services[kind].fetchById(id),
  })
}

/** Searches entries of a specified kind by a term and returns the matching results, retaining the most recent results for that kind while a new search is pending. */
export function useEntrySearch<T extends { id: string }>(
  kind: EntryKind,
  term: string,
) {
  const runtime = useWorkflowRuntime()
  const query = useWorkflowQuery(
    {
      key: `search:${kind}:${term}`,
      dependencies: dependencies(kind),
      load: () =>
        runtime.services[kind].search(term) as unknown as Promise<T[]>,
    },
    Boolean(term),
  )

  const [previous, setPrevious] = useState<{
    kind: EntryKind
    data: T[]
  } | null>(null)

  if (
    query.data !== null &&
    (query.data !== previous?.data || kind !== previous.kind)
  ) {
    setPrevious({ kind, data: query.data })
  }
  return {
    ...query,
    data: query.data ?? (previous?.kind === kind ? previous.data : null),
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
