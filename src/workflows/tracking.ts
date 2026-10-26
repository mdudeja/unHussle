import type { StoreApi } from 'zustand/vanilla'

export type TrackingSession = { taskId: string; startTime: number }
export type WorkflowWarning = {
  id: string
  message: string
  retry: () => Promise<void>
}
export type WorkflowUIState = {
  tracking: TrackingSession | null
  warnings: WorkflowWarning[]
}
export type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const storageKey = 'active_tracking_task'

export function createTracking(
  ui: StoreApi<WorkflowUIState>,
  storage?: SessionStorage,
) {
  const read = (): TrackingSession | null => {
    if (!storage) return null
    try {
      const session: unknown = JSON.parse(storage.getItem(storageKey) ?? 'null')
      if (
        !session ||
        typeof session !== 'object' ||
        !('taskId' in session) ||
        !('startTime' in session)
      )
        return null
      return typeof session.taskId === 'string' &&
        typeof session.startTime === 'number' &&
        Number.isFinite(session.startTime)
        ? { taskId: session.taskId, startTime: session.startTime }
        : null
    } catch {
      return null
    }
  }
  ui.setState({ tracking: read() })
  return {
    getActiveTracking: () => ui.getState().tracking,
    start(taskId: string, startTime: number) {
      const session = { taskId, startTime }
      storage?.setItem(storageKey, JSON.stringify(session))
      ui.setState({ tracking: session })
    },
    clear() {
      storage?.removeItem(storageKey)
      ui.setState({ tracking: null })
    },
  }
}
