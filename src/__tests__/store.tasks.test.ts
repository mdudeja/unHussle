import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Tasks Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      tasks: {
        ...state.tasks,
        data: [],
        isLoading: false,
        error: null,
      },
    }))
  })

  test('initialize with default state', () => {
    const state = useStore.getState()
    expect(state.tasks.data).toEqual([])
  })

  test('add a task', async () => {
    const { add } = useStore.getState().tasks
    await add({
      title: 'New Task',
    })

    const state = useStore.getState()

    // Check if task was added
    expect(state.tasks.data).toHaveLength(1)
    expect(state.tasks.data[0].title).toBe('New Task')
  })

  test('throw error when adding task with missing fields', async () => {
    const { add } = useStore.getState().tasks
    expect(await add({} as Parameters<typeof add>[0])).rejects.toThrow()
  })

  test('fetch tasks', async () => {
    const { fetch } = useStore.getState().tasks
    await fetch()

    const state = useStore.getState()
    expect(state.tasks.data).toHaveLength(1)
    expect(state.tasks.data[0].title).toBe('New Task')
    expect(state.tasks.isLoading).toBe(false)
  })

  test('update an existing task', async () => {
    const { fetch, update } = useStore.getState().tasks
    await fetch()

    let state = useStore.getState()
    const taskToUpdate = state.tasks.data[0]

    await update(taskToUpdate.id, { title: 'Updated Task Title' })

    state = useStore.getState()
    const updatedTask = state.tasks.data.find((t) => t.id === taskToUpdate.id)

    expect(updatedTask).toBeDefined()
    expect(updatedTask!.title).toBe('Updated Task Title')
  })

  test('throw error when updating non-existent task', async () => {
    const { update } = useStore.getState().tasks
    expect(await 
      update('non-existent-id', { title: 'Should Fail' }),
    ).rejects.toThrow()
  })

  test('delete a task', async () => {
    const { fetch, remove: deleteTask } = useStore.getState().tasks
    await fetch()

    let state = useStore.getState()
    const taskToDelete = state.tasks.data[0]

    await deleteTask(taskToDelete.id)

    state = useStore.getState()
    const deletedTask = state.tasks.data.find((t) => t.id === taskToDelete.id)

    expect(deletedTask).toBeUndefined()
    expect(state.tasks.data).toHaveLength(0)
  })

  test('throw error when deleting non-existent task', async () => {
    const { remove: deleteTask } = useStore.getState().tasks
    expect(await deleteTask('non-existent-id')).rejects.toThrow()
  })
})
