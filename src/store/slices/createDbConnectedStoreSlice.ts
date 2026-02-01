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
  fetch: () => Promise<void>
  add: (data: T['Write']) => Promise<void>
  update: (id: string, data: T['Update']) => Promise<void>
  remove: (id: string) => Promise<void>
  reset: () => Promise<void>
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

        fetch: async () => {
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
            const data = await serviceInstance.fetchAll()
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
