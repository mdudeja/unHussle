import { ProgressStatus } from '@c/types'
import { useStore } from '@/store'
import { getFrontendRuntime } from './runtime'

const transition = async (
  id: string,
  status: ProgressStatus,
): Promise<void> => {
  await getFrontendRuntime(useStore).commands.execute('task.transition', {
    id,
    status,
  })
}
export const startTask = (id: string) =>
  transition(id, ProgressStatus.IN_PROGRESS)
export const pauseTask = (id: string) => transition(id, ProgressStatus.PAUSED)
export const completeTask = (id: string) =>
  transition(id, ProgressStatus.COMPLETED)
export const cancelTask = (id: string) =>
  transition(id, ProgressStatus.CANCELLED)
export const deleteTask = async (id: string): Promise<void> => {
  await getFrontendRuntime(useStore).commands.execute('entity.mutate', {
    kind: 'tasks',
    action: 'delete',
    id,
  })
}
