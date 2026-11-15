import { useState } from 'react'
import { useApi } from './api-context'

type Failure = { taskId: string; message: string }

/** Runs task commands and tracks which tasks are busy or failed. */
export function useTaskChanges() {
  const api = useApi()
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [failure, setFailure] = useState<Failure | null>(null)

  const run = async (
    taskId: string,
    what: string,
    work: () => Promise<unknown>,
  ) => {
    setPendingIds((ids) => [...ids, taskId])
    setFailure((current) => (current?.taskId === taskId ? null : current))
    try {
      await work()
    } catch (error) {
      api.log.error(`Could not ${what} a task`, error)
      setFailure({ taskId, message: `Could not ${what} this task. Try again.` })
    } finally {
      setPendingIds((ids) => ids.filter((id) => id !== taskId))
    }
  }

  return {
    isPending: (taskId: string) => pendingIds.includes(taskId),
    errorFor: (taskId: string) =>
      failure?.taskId === taskId ? failure.message : undefined,
    update: (taskId: string, what: string, changes: Record<string, unknown>) =>
      run(taskId, what, () =>
        api.services.execute('entity.change', {
          kind: 'tasks',
          action: 'update',
          id: taskId,
          changes,
        }),
      ),
    remove: (taskId: string) =>
      run(taskId, 'delete', () =>
        api.services.execute('entity.delete', {
          kind: 'tasks',
          action: 'delete',
          id: taskId,
        }),
      ),
  }
}
