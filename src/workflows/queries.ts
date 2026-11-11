import { createStore } from 'zustand/vanilla'
import type { EntryKind } from '@c/workflows/contracts'
import type { Telemetry } from '@c/workflows/telemetry'
export type QueryDependency =
  | EntryKind
  | 'schedule'
  | 'occurrences'
  | 'schedulerSettings'
  | 'resourceContent'
  | 'vault'
  | 'extensions'

export type QueryState<T = unknown> = {
  data: T | null
  isLoading: boolean
  error: string | null
  stale: boolean
}
export const emptyQuery: QueryState = {
  data: null,
  isLoading: false,
  error: null,
  stale: true,
}
export type QueryDefinition<T> = {
  key: string
  dependencies: QueryDependency[]
  load: () => Promise<T>
}
type Registration = QueryDefinition<unknown> & {
  active: number
  generation: number
  pending?: Promise<unknown>
  /** Callers that shared the pending request instead of sending their own. */
  joined: number
}

/** `search:tasks:<term>` → `search:tasks`; the rest of a key may be user data. */
const queryName = (key: string) => key.split(':').slice(0, 2).join(':')

/** Requests, invalidation and stale-response protection belong to one owner. */
export function createQueryCoordinator({
  telemetry,
}: { telemetry?: Telemetry } = {}) {
  const store = createStore<{ entries: Record<string, QueryState> }>(() => ({
    entries: {},
  }))
  const registrations = new Map<string, Registration>()
  let disposed = false

  /** Captures the current query state for an entry, falling back to an empty query state when none exists. */
  const snapshot = <T>(key: string) =>
    (store.getState().entries[key] ?? emptyQuery) as QueryState<T>

  /** Applies a partial update to the query state associated with a key, unless the store has been disposed. */
  const patch = (key: string, values: Partial<QueryState>) => {
    if (disposed) return
    store.setState(({ entries }) => ({
      entries: { ...entries, [key]: { ...snapshot(key), ...values } },
    }))
  }

  /** Registers or updates a query definition for later use. */
  const define = <T>(definition: QueryDefinition<T>) => {
    const existing = registrations.get(definition.key)
    if (existing) Object.assign(existing, definition)
    else
      registrations.set(definition.key, {
        ...definition,
        active: 0,
        generation: 0,
        joined: 0,
      })
  }

  /** Ensures a registered query has fresh data, reusing in-flight loads and preventing outdated results from overwriting newer state. */
  const ensure = async <T>(key: string): Promise<T> => {
    const registration = registrations.get(key)
    if (!registration) throw new Error(`Unregistered query: ${key}`)
    if (registration.pending) {
      registration.joined++
      return registration.pending as Promise<T>
    }
    const current = snapshot<T>(key)
    if (!current.stale && current.data !== null) return current.data
    let obsolete = 0
    /** Loads and commits the latest registration data, ensuring invalidated requests never overwrite newer state. */
    const work = async () => {
      // Invalidated requests may finish, but may never replace newer state.
      for (;;) {
        const generation = registration.generation
        patch(key, { isLoading: true, error: null })
        try {
          const data = await registration.load()
          if (disposed) return data
          if (generation !== registration.generation) {
            obsolete++
            continue
          }
          patch(key, { data, stale: false, isLoading: false, error: null })
          return data
        } catch (error) {
          if (generation !== registration.generation && !disposed) {
            obsolete++
            continue
          }
          patch(key, { isLoading: false, stale: true, error: String(error) })
          throw error
        }
      }
    }
    registration.joined = 0
    const traced = telemetry
      ? () =>
          telemetry.span('query', queryName(key), async (span) => {
            try {
              return await work()
            } finally {
              span.setAttrs({ joined: registration.joined, obsolete })
            }
          })
      : work
    registration.pending = traced().finally(() => {
      registration.pending = undefined
    })
    return registration.pending as Promise<T>
  }

  /** Activates a registered query by tracking its active usage until it is deactivated. */
  const activate = (key: string) => {
    const registration = registrations.get(key)
    if (!registration) throw new Error(`Unregistered query: ${key}`)
    registration.active++
    return () => {
      registration.active = Math.max(0, registration.active - 1)
    }
  }

  /** Marks an entry as stale and invalidates its existing registration. */
  const markStale = (key: string) => {
    const registration = registrations.get(key)
    if (registration) registration.generation++
    patch(key, { stale: true })
  }

  /** Invalidates registered queries affected by the specified dependency kinds or keys, marking them stale and refreshing the active ones. */
  const invalidate = async (
    kinds: QueryDependency[],
    extraKeys: string[] = [],
  ) => {
    const affected: string[] = []
    for (const [key, registration] of registrations) {
      if (
        !extraKeys.includes(key) &&
        !registration.dependencies.some((kind) => kinds.includes(kind))
      )
        continue
      registration.generation++
      patch(key, { stale: true })
      if (registration.active || extraKeys.includes(key)) affected.push(key)
    }
    return Promise.all(
      affected.map(async (key) => {
        try {
          await ensure(key)
          return { key, error: null }
        } catch (error) {
          return { key, error }
        }
      }),
    )
  }

  /** Clears all stored entries and invalidates existing registrations. */
  const clear = () => {
    for (const registration of registrations.values()) registration.generation++
    store.setState({ entries: {} })
  }

  /** Marks the current instance as disposed and clears all registered resources and stored entries. */
  const dispose = () => {
    disposed = true
    registrations.clear()
    store.setState({ entries: {} })
  }

  return {
    store,
    snapshot,
    define,
    ensure,
    activate,
    markStale,
    invalidate,
    clear,
    dispose,
  }
}
export type QueryCoordinator = ReturnType<typeof createQueryCoordinator>
