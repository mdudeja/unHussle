import { ProgressStatus } from '@c/types/enums'
import { useStore } from '@/store'
import { getFrontendRuntime } from '@/bootstrap'

/** Transitions a task to the specified progress status. */
const transition = async (
  id: string,
  status: ProgressStatus,
): Promise<void> => {
  await getFrontendRuntime(useStore).commands.execute('task.transition', {
    id,
    status,
  })
}
/** Starts a task by marking it as in progress. */
export const startTask = (id: string) =>
  transition(id, ProgressStatus.IN_PROGRESS)
/** Pauses a task by marking it as paused. */
export const pauseTask = (id: string) => transition(id, ProgressStatus.PAUSED)
/** Marks a task as completed. */
export const completeTask = (id: string) =>
  transition(id, ProgressStatus.COMPLETED)
/** Cancels a task by marking it as cancelled. */
export const cancelTask = (id: string) =>
  transition(id, ProgressStatus.CANCELLED)
/** Deletes a task. */
export const deleteTask = async (id: string): Promise<void> => {
  await getFrontendRuntime(useStore).commands.execute('entity.delete', {
    kind: 'tasks',
    action: 'delete',
    id,
  })
}
