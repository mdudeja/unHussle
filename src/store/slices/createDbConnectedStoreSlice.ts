import type { StoreApi } from 'zustand/vanilla'
import type { StoreState } from '@/store'
import type { EntityKind } from '@c/workflows/contracts'
import { getFrontendRuntime } from '@/workflows/runtime'
import { DbEntityTypes, WithAttachments } from '@c/types/index'
import { StateCreator } from 'zustand'

export interface DbSlice<T extends DbEntityTypes> {
  data: T['Read'][]
  isLoading: boolean
  error: string | null
  fetch: (pageNumber?: number) => Promise<void>
  search: (query: string) => Promise<T['Read'][]>
  add: (data: WithAttachments<T['Write']>) => Promise<T['Read']>
  update: (id: string, data: WithAttachments<T['Update']>) => Promise<void>
  remove: (id: string) => Promise<void>
  reset: () => Promise<void>
  getById: (id?: string | null) => T['Read'] | null
}

export default function generateCreateDbConnectedStateSlice<
  T extends DbEntityTypes,
  K extends EntityKind,
>(sliceName: K) {
  type State = { [key in K]: DbSlice<T> }
  const creator: StateCreator<State> = (_set, get, api) => {
    const runtime = () =>
      getFrontendRuntime(api as unknown as StoreApi<StoreState>)
    const kind = sliceName
    let pending = 0
    const operation = async <R>(work: () => Promise<R>): Promise<R> => {
      pending++
      api.setState(
        (state) =>
          ({
            [sliceName]: { ...state[sliceName], isLoading: true, error: null },
          }) as State,
      )
      try {
        return await work()
      } catch (error) {
        api.setState(
          (state) =>
            ({
              [sliceName]: { ...state[sliceName], error: String(error) },
            }) as State,
        )
        throw error
      } finally {
        pending--
        api.setState(
          (state) =>
            ({
              [sliceName]: { ...state[sliceName], isLoading: pending > 0 },
            }) as State,
        )
      }
    }
    return {
      [sliceName]: {
        data: [] as T['Read'][],
        isLoading: false,
        error: null,
        fetch: (page = 1) =>
          operation(async () => {
            await runtime().fetchList(kind, page)
          }),
        search: async (term: string) =>
          runtime().search(kind, term) as Promise<T['Read'][]>,
        add: (changes: WithAttachments<T['Write']>) =>
          operation(
            async () =>
              runtime().commands.execute('entity.mutate', {
                kind,
                action: 'create',
                changes,
              }) as Promise<T['Read']>,
          ),
        update: (id: string, changes: WithAttachments<T['Update']>) =>
          operation(async () => {
            await runtime().commands.execute('entity.mutate', {
              kind,
              action: 'update',
              id,
              changes,
            })
          }),
        remove: (id: string) =>
          operation(async () => {
            await runtime().commands.execute('entity.mutate', {
              kind,
              action: 'delete',
              id,
            })
          }),
        reset: () =>
          operation(async () => {
            await runtime().commands.execute('entity.mutate', {
              kind,
              action: 'deleteAll',
            })
          }),
        getById: (id?: string | null) => {
          if (!id) return null
          return get()[sliceName].data.find((row) => row.id === id) ?? null
        },
      },
    } as State
  }
  return creator
}
