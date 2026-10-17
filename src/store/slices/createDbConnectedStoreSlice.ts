import { DbService } from '@/services/database/DbService'
import { InferTableTypes } from '@c/types/index'
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'
import { StateCreator } from 'zustand'

export interface DbSlice<
  T extends InferTableTypes<unknown, SQLiteTableWithColumns<any>>,
> {
  data: T['Read'][]
  isLoading: boolean
  error: string | null
  fetch: (pageNumber?: number) => Promise<void>
  search: (query: string) => Promise<T['Read'][]>
  add: (data: T['Write']) => Promise<T['Read']>
  update: (id: string, data: T['Update']) => Promise<void>
  remove: (id: string) => Promise<void>
  reset: () => Promise<void>
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
  T extends InferTableTypes<unknown, SQLiteTableWithColumns<any>>,
  K extends string,
>(serviceInstance: DbService<T>, sliceName: K) {
  const creator: StateCreator<{ [key in K]: DbSlice<T> }> = (set) =>
    ({
      [sliceName]: {
        data: [] as T['Read'][],
        isLoading: false,
        error: null,

        fetch: async (pageNumber?: number) => {
          set(
            (state) =>
              ({
                [sliceName]: {
                  ...state[sliceName],
                  isLoading: true,
                  error: null,
                },
              }) as any,
          )
          try {
            const data = await serviceInstance.fetchPaginated(
              pageNumber || 1,
              fetchLimits[sliceName] || 50,
            )
            set(
              (state) =>
                ({
                  [sliceName]: { ...state[sliceName], data, isLoading: false },
                }) as any,
            )
          } catch (error) {
            set(
              (state) =>
                ({
                  [sliceName]: {
                    ...state[sliceName],
                    error: 'Failed to fetch data',
                    isLoading: false,
                  },
                }) as any,
            )
            throw error
          }
        },

        search: async (query: string) => {
          set(
            (state) =>
              ({
                [sliceName]: {
                  ...state[sliceName],
                  isLoading: true,
                  error: null,
                },
              }) as any,
          )
          try {
            const searchResults = await serviceInstance.search(query)
            set(
              (state) =>
                ({
                  [sliceName]: {
                    ...state[sliceName],
                    searchResults,
                    isLoading: false,
                  },
                }) as any,
            )
          } catch (error) {
            set(
              (state) =>
                ({
                  [sliceName]: {
                    ...state[sliceName],
                    error: 'Failed to search data',
                    isLoading: false,
                  },
                }) as any,
            )
          }
        },

        add: async (data: T['Write']) => {
          set(
            (state) =>
              ({
                [sliceName]: {
                  ...state[sliceName],
                  isLoading: true,
                  error: null,
                },
              }) as any,
          )
          try {
            const newData = await serviceInstance.create(data)
            set(
              (state) =>
                ({
                  [sliceName]: {
                    ...state[sliceName],
                    data: [...state[sliceName].data, newData],
                    isLoading: false,
                  },
                }) as any,
            )
            return newData
          } catch (error) {
            set(
              (state) =>
                ({
                  [sliceName]: {
                    ...state[sliceName],
                    error: 'Failed to add data',
                    isLoading: false,
                  },
                }) as any,
            )
            throw error
          }
        },

        update: async (id: string, data: T['Update']) => {
          set(
            (state) =>
              ({
                [sliceName]: {
                  ...state[sliceName],
                  isLoading: true,
                  error: null,
                },
              }) as any,
          )
          try {
            const updatedData = await serviceInstance.update(id, data)
            set(
              (state) =>
                ({
                  [sliceName]: {
                    ...state[sliceName],
                    data: state[sliceName].data.map((d) =>
                      d.id === id ? updatedData : d,
                    ),
                    isLoading: false,
                  },
                }) as any,
            )
          } catch (error) {
            set(
              (state) =>
                ({
                  [sliceName]: {
                    ...state[sliceName],
                    error: 'Failed to update data',
                    isLoading: false,
                  },
                }) as any,
            )
            throw error
          }
        },

        remove: async (id: string) => {
          set(
            (state) =>
              ({
                [sliceName]: {
                  ...state[sliceName],
                  isLoading: true,
                  error: null,
                },
              }) as any,
          )
          try {
            await serviceInstance.delete(id)
            set(
              (state) =>
                ({
                  [sliceName]: {
                    ...state[sliceName],
                    data: state[sliceName].data.filter((d) => d.id !== id),
                    isLoading: false,
                  },
                }) as any,
            )
          } catch (error) {
            set(
              (state) =>
                ({
                  [sliceName]: {
                    ...state[sliceName],
                    error: 'Failed to remove data',
                    isLoading: false,
                  },
                }) as any,
            )
            throw error
          }
        },

        reset: async () => {
          set(
            (state) =>
              ({
                [sliceName]: {
                  ...state[sliceName],
                  data: [],
                  isLoading: false,
                  error: null,
                },
              }) as any,
          )
          try {
            await serviceInstance.reset()
          } catch (error) {
            set(
              (state) =>
                ({
                  [sliceName]: {
                    ...state[sliceName],
                    error: 'Failed to reset data',
                    isLoading: false,
                  },
                }) as any,
            )
            throw error
          }
        },
      },
    }) as unknown as { [key in K]: DbSlice<T> }
  return creator
}
