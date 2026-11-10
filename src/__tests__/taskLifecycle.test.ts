import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { useStore } from '@/store'
import { getFrontendRuntime } from '@/workflows/runtime'
const timeTrackingService = {
  getActiveTracking: () =>
    getFrontendRuntime(useStore).tracking.getActiveTracking(),
}
import {
  cancelTask,
  completeTask,
  deleteTask,
  pauseTask,
  startTask,
} from '@/workflows/taskCommands'
import { ProgressStatus } from '@c/types/enums'

// The time tracker keeps its session in localStorage, which bun doesn't have.
if (!('localStorage' in globalThis)) {
  const items = new Map<string, string>()
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, value),
      removeItem: (key: string) => items.delete(key),
    },
  })
}

describe('Task lifecycle', () => {
  /** Retrieves a task by its identifier from the store. */
  const getTask = (id: string) => useStore.getState().tasks.getById(id)!
  let firstId: string
  let secondId: string

  beforeAll(async () => {
    const { add } = useStore.getState().tasks
    firstId = (await add({ title: 'Lifecycle task 1' })).id
    secondId = (await add({ title: 'Lifecycle task 2' })).id
  })

  afterAll(async () => {
    await deleteTask(firstId)
    await deleteTask(secondId)
  })

  test('start marks the task in progress and tracks it', async () => {
    await startTask(firstId)

    const task = getTask(firstId)
    expect(task.status).toBe(ProgressStatus.IN_PROGRESS)
    expect(task.started_at).toBeNumber()
    expect(timeTrackingService.getActiveTracking()?.taskId).toBe(firstId)
  })

  test('starting another task pauses the tracked one', async () => {
    const firstStartedAt = getTask(firstId).started_at
    await startTask(secondId)

    expect(getTask(firstId).status).toBe(ProgressStatus.PAUSED)
    expect(getTask(firstId).started_at).toBe(firstStartedAt)
    // Stopping the timer saved at least a minute (sessions round up).
    expect(getTask(firstId).spent_minutes).toBeGreaterThanOrEqual(1)
    expect(getTask(secondId).status).toBe(ProgressStatus.IN_PROGRESS)
    expect(timeTrackingService.getActiveTracking()?.taskId).toBe(secondId)
  })

  test('restarting keeps the original started_at', async () => {
    const startedAt = getTask(firstId).started_at
    await startTask(firstId)
    expect(getTask(firstId).started_at).toBe(startedAt)
  })

  test('pause stops tracking', async () => {
    await pauseTask(firstId)

    expect(getTask(firstId).status).toBe(ProgressStatus.PAUSED)
    expect(timeTrackingService.getActiveTracking()).toBeNull()
  })

  test('complete sets completed_at', async () => {
    await completeTask(firstId)

    const task = getTask(firstId)
    expect(task.status).toBe(ProgressStatus.COMPLETED)
    expect(task.completed_at).toBeNumber()
  })

  test('cancel marks the task cancelled', async () => {
    await cancelTask(secondId)
    expect(getTask(secondId).status).toBe(ProgressStatus.CANCELLED)
  })

  test('deleting the tracked task drops the session', async () => {
    await startTask(secondId)
    await deleteTask(secondId)

    expect(useStore.getState().tasks.getById(secondId)).toBeNull()
    expect(timeTrackingService.getActiveTracking()).toBeNull()
    secondId = (await useStore.getState().tasks.add({ title: 'Placeholder' }))
      .id
  })
})
