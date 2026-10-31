import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useStore as useZustandStore } from 'zustand'
import { useStore } from '@/store'
import type { EntryKind, EntryRecord } from '@c/workflows/contracts'
import { Logger } from '@c/Logger'
import { getFrontendRuntime, dependencies } from './runtime'
import { fetchLimits } from './services'
import type { QueryDefinition } from './queries'

export const useWorkflowRuntime = () => getFrontendRuntime(useStore)

export function useWorkflowQuery<T>(
  definition: QueryDefinition<T>,
  enabled = true,
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
    queries
      .ensure(key)
      .catch((error) =>
        Logger.getInstance().error(`Failed to load ${key}`, { error }),
      )
    return deactivate
  }, [queries, key, enabled, isDBReady])

  return {
    ...state,
    isLoading:
      enabled &&
      (state.isLoading || (state.data === null && state.error === null)),
  }
}

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

export function useEntryDetail(kind: EntryKind, id: string) {
  const runtime = useWorkflowRuntime()
  return useWorkflowQuery({
    key: `detail:${kind}:${id}`,
    dependencies: dependencies(kind),
    load: () => runtime.services[kind].fetchById(id),
  })
}

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

export function useTrackingSession() {
  return useZustandStore(useWorkflowRuntime().ui, (state) => state.tracking)
}
