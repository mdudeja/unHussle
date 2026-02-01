import { makeTextRequest } from '@/lib/server'
import { StateCreator } from 'zustand'

export interface UISlice {
  isDBReady: boolean
  dbError?: string
  checkDBReady: () => Promise<void>
  isSidebarOpen: boolean
  toggleSidebar: () => void
  activeModal: string | null
  openModal: (modalId: string) => void
  closeModal: () => void
}

export const createUISlice: StateCreator<UISlice> = (set) => ({
  isDBReady: false,
  checkDBReady: async () => {
    const maxRetries = 10
    const retryDelay = 2000 // 2 seconds

    const dbServerPort = import.meta.env.VITE_DB_SERVER_PORT
      ? parseInt(import.meta.env.VITE_DB_SERVER_PORT, 10)
      : null

    if (!dbServerPort) {
      throw new Error('VITE_DB_SERVER_PORT is not defined')
    }

    const dbServerUrl = `http://localhost:${dbServerPort}/health`

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await makeTextRequest({
          url: dbServerUrl,
          method: 'GET',
        })
        if (response === 'OK') {
          console.log('Database server is ready.')
          set(() => ({ isDBReady: true, dbError: undefined }))
          return
        }
      } catch (err) {
        console.warn(`Attempt ${attempt} to connect to database server failed.`)
        if (attempt === maxRetries) {
          set(() => ({
            isDBReady: false,
            dbError:
              'Failed to connect to database server after maximum retries',
          }))
          return
        }
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }
  },
  isSidebarOpen: true,
  toggleSidebar: () =>
    set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  activeModal: null,
  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
})
