import { apiAddress } from '@/lib/apiAddress'
import { makeTextRequest } from '@/lib/server'
import { EntityRouteKey } from '@/lib/entityRoutes'
import { StateCreator } from 'zustand'
import { Logger } from '@c/Logger'

// The entity shown in the global edit dialog (see EntityEditDialogHost).
export type EditingEntity = { kind: EntityRouteKey; id: string }

// A task action waiting on "did you stop at some point?" (see OvernightDialogHost).
export type OvernightPrompt = {
  taskId: string
  /** Set when the interval belongs to a recurring task's occurrence. */
  occurrenceId?: string | null
  startedAt: number
  then: 'pause' | 'complete' | 'cancel'
}

export interface UISlice {
  isDBReady: boolean
  dbError?: string
  checkDBReady: () => Promise<void>
  editing: EditingEntity | null
  openEditor: (kind: EntityRouteKey, id: string) => void
  closeEditor: () => void
  overnightPrompt: OvernightPrompt | null
  askOvernight: (prompt: OvernightPrompt) => void
  closeOvernight: () => void
}

/** Creates the UI state slice that tracks database readiness and manages editor and overnight prompt state. */
export const createUISlice: StateCreator<UISlice> = (set) => ({
  isDBReady: false,
  checkDBReady: async () => {
    const maxRetries = 10
    const retryDelay = 2000 // 2 seconds

    const dbServerUrl = apiAddress('health')

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await makeTextRequest({
          url: dbServerUrl,
          method: 'GET',
        })
        if (response === 'OK') {
          Logger.getInstance().info('Database server is ready.')
          set(() => ({ isDBReady: true, dbError: undefined }))
          return
        }
      } catch (err) {
        Logger.getInstance().warn(
          `Attempt ${attempt} to connect to database server failed`,
          { error: err },
        )
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
  editing: null,
  openEditor: (kind, id) => set({ editing: { kind, id } }),
  closeEditor: () => set({ editing: null }),
  overnightPrompt: null,
  askOvernight: (prompt) => set({ overnightPrompt: prompt }),
  closeOvernight: () => set({ overnightPrompt: null }),
})
