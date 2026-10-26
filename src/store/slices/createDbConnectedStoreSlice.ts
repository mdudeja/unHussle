import { DbService } from '@/services/database/DbService'
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

const fetchLimits: { [key: string]: number } = {
  areas: +(import.meta.env.VITE_FETCH_LIMIT_AREAS || '50'),
  goals: +(import.meta.env.VITE_FETCH_LIMIT_GOALS || '30'),
  projects: +(import.meta.env.VITE_FETCH_LIMIT_PROJECTS || '30'),
  resources: +(import.meta.env.VITE_FETCH_LIMIT_RESOURCES || '100'),
  tags: +(import.meta.env.VITE_FETCH_LIMIT_TAGS || '100'),
  tasks: +(import.meta.env.VITE_FETCH_LIMIT_TASKS || '100'),
  time_entries: +(import.meta.env.VITE_FETCH_LIMIT_TIME_ENTRIES || '100'),
  urls: +(import.meta.env.VITE_FETCH_LIMIT_URLS || '100'),
}

export default function generateCreateDbConnectedStateSlice<
  T extends DbEntityTypes,
  K extends string,
>(serviceInstance: DbService<T>, sliceName: K) {
  type State = { [key in K]: DbSlice<T> }

  const creator: StateCreator<State> = (set, get) => {
    /** Merge a partial update into this slice */
    const patch = (fn: (slice: DbSlice<T>) => Partial<DbSlice<T>>) =>
      set(
        (state) =>
          ({
            [sliceName]: { ...state[sliceName], ...fn(state[sliceName]) },
          }) as State,
      )

    return {
      [sliceName]: {
        data: [] as T['Read'][],
        isLoading: false,
        error: null,

        fetch: async (pageNumber?: number) => {
          patch(() => ({ isLoading: true, error: null }))
          try {
            const data = await serviceInstance.fetchPaginated(
              pageNumber || 1,
              fetchLimits[sliceName] || 50,
            )
            patch(() => ({ data, isLoading: false }))
          } catch (error) {
            patch(() => ({ error: 'Failed to fetch data', isLoading: false }))
            throw error
          }
        },

        search: async (query: string) => {
          patch(() => ({ isLoading: true, error: null }))
          try {
            const searchResults = await serviceInstance.search(query)
            patch(() => ({ isLoading: false }))
            return searchResults
          } catch {
            patch(() => ({ error: 'Failed to search data', isLoading: false }))
            return [] as T['Read'][]
          }
        },

        add: async (data: WithAttachments<T['Write']>) => {
          patch(() => ({ isLoading: true, error: null }))
          try {
            const newData = await serviceInstance.create(data)
            patch((slice) => ({
              data: [...slice.data, newData],
              isLoading: false,
            }))
            return newData
          } catch (error) {
            patch(() => ({ error: 'Failed to add data', isLoading: false }))
            throw error
          }
        },

        update: async (id: string, data: WithAttachments<T['Update']>) => {
          patch(() => ({ isLoading: true, error: null }))
          try {
            const updatedData = await serviceInstance.update(id, data)
            patch((slice) => ({
              data: slice.data.map((d) => (d.id === id ? updatedData : d)),
              isLoading: false,
            }))
          } catch (error) {
            patch(() => ({ error: 'Failed to update data', isLoading: false }))
            throw error
          }
        },

        remove: async (id: string) => {
          patch(() => ({ isLoading: true, error: null }))
          try {
            await serviceInstance.delete(id)
            patch((slice) => ({
              data: slice.data.filter((d) => d.id !== id),
              isLoading: false,
            }))
          } catch (error) {
            patch(() => ({ error: 'Failed to remove data', isLoading: false }))
            throw error
          }
        },

        reset: async () => {
          patch(() => ({ data: [], isLoading: false, error: null }))
          try {
            await serviceInstance.reset()
          } catch (error) {
            patch(() => ({ error: 'Failed to reset data', isLoading: false }))
            throw error
          }
        },

        getById: (id?: string | null) => {
          if (!id) return null
          return get()[sliceName].data.find((d) => d.id === id) ?? null
        },
      },
    } as State
  }
  return creator
}
