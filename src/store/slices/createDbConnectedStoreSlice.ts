import type { StoreApi } from 'zustand/vanilla'
import type { StoreState } from '@/store'
import { commandHeadForKind, type EntryKind } from '@c/workflows/contracts'
import { getFrontendRuntime } from '@/bootstrap'
import { DbEntityTypes, WithSupporters } from '@c/types/index'
import { StateCreator } from 'zustand'

export interface DbSlice<T extends DbEntityTypes> {
  isLoading: boolean
  error: string | null
  add: (data: WithSupporters<T['Write']>) => Promise<T['Read']>
  update: (id: string, data: WithSupporters<T['Update']>) => Promise<void>
  remove: (id: string) => Promise<void>
  reset: () => Promise<void>
}

/** Creates a frontend store slice that exposes mutation commands and their UI loading/error state. */
export default function generateCreateDbConnectedStateSlice<
  T extends DbEntityTypes,
  K extends EntryKind,
>(sliceName: K) {
  type State = { [key in K]: DbSlice<T> }
  /** Creates a frontend store slice that exposes mutation commands and their UI loading/error state. */
  const creator: StateCreator<State> = (_set, _get, api) => {
    /** Provides the frontend runtime for the current store. */
    const runtime = () =>
      getFrontendRuntime(api as unknown as StoreApi<StoreState>)
    const kind = sliceName
    const head = commandHeadForKind[kind]
    let pending = 0
    /** Runs an asynchronous task while tracking its loading and error state. */
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
        isLoading: false,
        error: null,
        add: (changes: WithSupporters<T['Write']>) =>
          operation(
            async () =>
              runtime().commands.execute(`${head}.add`, {
                kind,
                action: 'create',
                changes,
              }) as Promise<T['Read']>,
          ),
        update: (id: string, changes: WithSupporters<T['Update']>) =>
          operation(async () => {
            await runtime().commands.execute(`${head}.change`, {
              kind,
              action: 'update',
              id,
              changes,
            })
          }),
        remove: (id: string) =>
          operation(async () => {
            await runtime().commands.execute(`${head}.delete`, {
              kind,
              action: 'delete',
              id,
            })
          }),
        reset: () =>
          operation(async () => {
            await runtime().commands.execute(`${head}.deleteAll`, {
              kind,
              action: 'deleteAll',
            })
          }),
      },
    } as State
  }
  return creator
}
