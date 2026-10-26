import { createStore } from 'zustand/vanilla'
import type { EntityKind } from '@c/workflows/contracts'

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
  dependencies: EntityKind[]
  load: () => Promise<T>
  onData?: (data: T) => void
}
type Registration = QueryDefinition<unknown> & {
  active: number
  generation: number
  pending?: Promise<unknown>
}

/** Requests, invalidation and stale-response protection belong to one owner. */
export function createQueryCoordinator() {
  const store = createStore<{ entries: Record<string, QueryState> }>(() => ({
    entries: {},
  }))
  const registrations = new Map<string, Registration>()
  let disposed = false
  const snapshot = <T>(key: string) =>
    (store.getState().entries[key] ?? emptyQuery) as QueryState<T>
  const patch = (key: string, values: Partial<QueryState>) => {
    if (disposed) return
    store.setState(({ entries }) => ({
      entries: { ...entries, [key]: { ...snapshot(key), ...values } },
    }))
  }
  const define = <T>(definition: QueryDefinition<T>) => {
    const existing = registrations.get(definition.key)
    if (existing) Object.assign(existing, definition)
    else
      registrations.set(definition.key, {
        ...definition,
        active: 0,
        generation: 0,
      } as Registration)
  }
  const ensure = async <T>(key: string): Promise<T> => {
    const registration = registrations.get(key)
    if (!registration) throw new Error(`Unregistered query: ${key}`)
    if (registration.pending) return registration.pending as Promise<T>
    const current = snapshot<T>(key)
    if (!current.stale && current.data !== null) return current.data
    const work = async () => {
      // Invalidated requests may finish, but may never replace newer state.
      for (;;) {
        const generation = registration.generation
        patch(key, { isLoading: true, error: null })
        try {
          const data = await registration.load()
          if (disposed) return data
          if (generation !== registration.generation) continue
          registration.onData?.(data)
          patch(key, { data, stale: false, isLoading: false, error: null })
          return data
        } catch (error) {
          if (generation !== registration.generation && !disposed) continue
          patch(key, { isLoading: false, stale: true, error: String(error) })
          throw error
        }
      }
    }
    registration.pending = work().finally(() => {
      registration.pending = undefined
    })
    return registration.pending as Promise<T>
  }
  return {
    store,
    snapshot,
    define,
    ensure,
    activate(key: string) {
      const registration = registrations.get(key)
      if (!registration) throw new Error(`Unregistered query: ${key}`)
      registration.active++
      return () => {
        registration.active = Math.max(0, registration.active - 1)
      }
    },
    markStale(key: string) {
      const registration = registrations.get(key)
      if (registration) registration.generation++
      patch(key, { stale: true })
    },
    async invalidate(kinds: EntityKind[], extraKeys: string[] = []) {
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
    },
    clear() {
      for (const registration of registrations.values())
        registration.generation++
      store.setState({ entries: {} })
    },
    dispose() {
      disposed = true
      registrations.clear()
      store.setState({ entries: {} })
    },
  }
}
export type QueryCoordinator = ReturnType<typeof createQueryCoordinator>
