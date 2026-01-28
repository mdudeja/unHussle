import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { useStore } from '@/store'

// Mock the services before they are used
mock.module('@/services/TasksService', () => ({
  TasksService: {
    getInstance: () => ({
      fetchAll: mock(() =>
        Promise.resolve([
          {
            id: '1',
            title: 'Test Task',
            status: 'planned',
            priority: 'medium',
            created_at: 0,
            updated_at: 0,
            tag_ids: [],
            url_ids: [],
          },
        ]),
      ),
      create: mock((task: any) =>
        Promise.resolve({
          ...task,
          id: 'new-id',
          created_at: 123,
          updated_at: 123,
        }),
      ),
    }),
  },
}))

describe('Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      tasks: {
        ...state.tasks,
        data: [],
        isLoading: false,
        error: null,
      },
      isSidebarOpen: true,
      activeModal: null,
    }))
  })

  it('should initialize with default state', () => {
    const state = useStore.getState()
    expect(state.tasks.data).toEqual([])
    expect(state.isSidebarOpen).toBe(true)
  })

  it('should toggle sidebar', () => {
    const { toggleSidebar } = useStore.getState()
    toggleSidebar()
    expect(useStore.getState().isSidebarOpen).toBe(false)
  })

  it('should fetch tasks', async () => {
    const { fetch } = useStore.getState().tasks
    await fetch()

    const state = useStore.getState()
    expect(state.tasks.data).toHaveLength(1)
    expect(state.tasks.data[0].title).toBe('Test Task')
    expect(state.tasks.isLoading).toBe(false)
  })

  it('should add a task', async () => {
    const { add } = useStore.getState().tasks
    await add({
      title: 'New Task',
      status: 'planned',
      priority: 'medium',
      tag_ids: [],
      url_ids: [],
    } as any)

    const state = useStore.getState()

    // Check if task was added
    expect(state.tasks.data).toHaveLength(1)
    expect(state.tasks.data[0].title).toBe('New Task')
  })
})
