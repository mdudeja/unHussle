import { readList } from '@c/testing/frontendReads'
import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Tasks Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      tasks: {
        ...state.tasks,
        isLoading: false,
        error: null,
      },
    }))
  })

  test('initialize with default state', async () => {
    const state = useStore.getState()
    expect('data' in state.tasks).toBe(false)
  })

  test('add a task', async () => {
    const { add } = useStore.getState().tasks
    await add({
      title: 'New Task',
    })

    // Check if task was added
    expect(await readList('tasks')).toHaveLength(1)
    expect((await readList('tasks'))[0].title).toBe('New Task')
  })

  test('throw error when adding task with missing fields', async () => {
    const { add } = useStore.getState().tasks
    await expect(add({} as Parameters<typeof add>[0])).rejects.toThrow()
  })

  test('fetch tasks', async () => {
    /** Fetches the list of tasks. */
    const fetch = () => readList('tasks')
    await fetch()

    const state = useStore.getState()
    expect(await readList('tasks')).toHaveLength(1)
    expect((await readList('tasks'))[0].title).toBe('New Task')
    expect(state.tasks.isLoading).toBe(false)
  })

  test('update an existing task', async () => {
    const { update } = useStore.getState().tasks
    /** Fetches the list of tasks. */
    const fetch = () => readList('tasks')
    await fetch()

    const taskToUpdate = (await readList('tasks'))[0]

    await update(taskToUpdate.id, { title: 'Updated Task Title' })

    const updatedTask = (await readList('tasks')).find(
      (t) => t.id === taskToUpdate.id,
    )

    expect(updatedTask).toBeDefined()
    expect(updatedTask!.title).toBe('Updated Task Title')
  })

  test('throw error when updating non-existent task', async () => {
    const { update } = useStore.getState().tasks
    await expect(
      update('non-existent-id', { title: 'Should Fail' }),
    ).rejects.toThrow()
  })

  test('delete a task', async () => {
    const { remove: deleteTask } = useStore.getState().tasks
    /** Fetches the list of tasks. */
    const fetch = () => readList('tasks')
    await fetch()

    const taskToDelete = (await readList('tasks'))[0]

    await deleteTask(taskToDelete.id)

    const deletedTask = (await readList('tasks')).find(
      (t) => t.id === taskToDelete.id,
    )

    expect(deletedTask).toBeUndefined()
  })

  test('throw error when deleting non-existent task', async () => {
    const { remove: deleteTask } = useStore.getState().tasks
    await expect(deleteTask('non-existent-id')).rejects.toThrow()
  })
})
