import { useStore } from '@/store'
import { timeTrackingService } from '@/services/TimeTrackingService'
import { TasksService } from '@/services/database/TasksService'
import { ProgressStatus, Task } from '@c/types/index'
import { getNowMillis } from '@c/datetimeUtils'

// Status transitions for a task, kept in sync with the time tracker. Tracking
// is always stopped before `tasks.update` because stopping writes the task's
// `spent_minutes` straight to the server; updating afterwards puts that row
// (with the new total) into the store.

const getTrackedTaskId = () =>
  timeTrackingService.getActiveTracking()?.taskId ?? null

const stopTrackingIf = async (taskId: string) => {
  if (getTrackedTaskId() === taskId) {
    await timeTrackingService.stopTracking()
  }
}

const updateTask = (id: string, data: Task['Update']) =>
  useStore.getState().tasks.update(id, data)

// The task may not be in the store (e.g. it came from search results).
const findStartedAt = async (id: string) => {
  const task =
    useStore.getState().tasks.getById(id) ??
    (await TasksService.getInstance().fetchById(id))
  return task?.started_at ?? null
}

/** Starts tracking `id`; a different task that was being tracked is paused. */
export const startTask = async (id: string) => {
  const currentlyTrackedId = getTrackedTaskId()

  if (currentlyTrackedId && currentlyTrackedId !== id) {
    await pauseTask(currentlyTrackedId)
  }
  await timeTrackingService.startTracking(id)
  await updateTask(id, {
    status: ProgressStatus.IN_PROGRESS,
    started_at: (await findStartedAt(id)) ?? getNowMillis(),
  })
}

export const pauseTask = async (id: string) => {
  await stopTrackingIf(id)
  await updateTask(id, { status: ProgressStatus.PAUSED })
}

export const completeTask = async (id: string) => {
  await stopTrackingIf(id)
  await updateTask(id, {
    status: ProgressStatus.COMPLETED,
    completed_at: getNowMillis(),
  })
}

export const cancelTask = async (id: string) => {
  await stopTrackingIf(id)
  await updateTask(id, { status: ProgressStatus.CANCELLED })
}

/** Deletes the task, stopping its timer first so it isn't left running. */
export const deleteTask = async (id: string) => {
  if (getTrackedTaskId() === id) {
    // Nothing to save the time against, so drop the session instead.
    timeTrackingService.discardTracking()
  }
  await useStore.getState().tasks.remove(id)
}
