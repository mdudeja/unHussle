import { describe, it, expect, beforeEach } from 'bun:test'
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

  it('should initialize with default state', () => {
    const state = useStore.getState()
    expect(state.tasks.data).toEqual([])
  })

  it('should add a task', async () => {
    const { add } = useStore.getState().tasks
    await add({
      title: 'New Task',
    } as any)

    const state = useStore.getState()

    // Check if task was added
    expect(state.tasks.data).toHaveLength(1)
    expect(state.tasks.data[0].title).toBe('New Task')
  })

  it('should throw error when adding task with missing fields', async () => {
    const { add } = useStore.getState().tasks
    expect(add({} as any)).rejects.toThrow()
  })

  it('should fetch tasks', async () => {
    const { fetch } = useStore.getState().tasks
    await fetch()

    const state = useStore.getState()
    expect(state.tasks.data).toHaveLength(1)
    expect(state.tasks.data[0].title).toBe('New Task')
    expect(state.tasks.isLoading).toBe(false)
  })

  it('should update an existing task', async () => {
    const { fetch, update } = useStore.getState().tasks
    await fetch()

    let state = useStore.getState()
    const taskToUpdate = state.tasks.data[0]

    await update(taskToUpdate.id, { title: 'Updated Task Title' } as any)

    state = useStore.getState()
    const updatedTask = state.tasks.data.find((t) => t.id === taskToUpdate.id)

    expect(updatedTask).toBeDefined()
    expect(updatedTask!.title).toBe('Updated Task Title')
  })

  it('should throw error when updating non-existent task', async () => {
    const { update } = useStore.getState().tasks
    expect(
      update('non-existent-id', { title: 'Should Fail' } as any),
    ).rejects.toThrow()
  })

  it('should delete a task', async () => {
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

  it('should throw error when deleting non-existent task', async () => {
    const { remove: deleteTask } = useStore.getState().tasks
    expect(deleteTask('non-existent-id')).rejects.toThrow()
  })
})
