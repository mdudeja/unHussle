import { describe, it, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Projects Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      projects: {
        ...state.projects,
        data: [],
        isLoading: false,
        error: null,
      },
    }))
  })

  it('should initialize with default state', () => {
    const state = useStore.getState()
    expect(state.projects.data).toEqual([])
  })

  it('should create a new project', async () => {
    const { add } = useStore.getState().projects
    const newProjectData = {
      title: 'New Project',
    }
    await add(newProjectData)

    const state = useStore.getState()
    const newProject = state.projects.data.find(
      (p) => p.title === 'New Project',
    )

    expect(newProject).toBeDefined()
    expect(state.projects.data).toHaveLength(1)
  })

  it('should throw error when creating project with missing fields', async () => {
    const { add } = useStore.getState().projects
    expect(add({} as any)).rejects.toThrow()
  })

  it('should fetch projects', async () => {
    const { fetch } = useStore.getState().projects
    await fetch()

    const state = useStore.getState()
    expect(state.projects.data).toHaveLength(1)
    expect(state.projects.data[0].title).toBe('New Project')
    expect(state.projects.isLoading).toBe(false)
  })

  it('should update an existing project', async () => {
    const { fetch, update } = useStore.getState().projects
    await fetch()

    let state = useStore.getState()
    const projectToUpdate = state.projects.data[0]

    await update(projectToUpdate.id, { title: 'Updated Project Title' })

    state = useStore.getState()
    const updatedProject = state.projects.data.find(
      (p) => p.id === projectToUpdate.id,
    )

    expect(updatedProject).toBeDefined()
    expect(updatedProject?.title).toBe('Updated Project Title')
  })

  it('should throw error when updating non-existent project', async () => {
    const { update } = useStore.getState().projects
    expect(
      update('non-existent-id', { title: 'Should Fail' }),
    ).rejects.toThrow()
  })

  it('should delete a project', async () => {
    const { fetch, remove: deleteProject } = useStore.getState().projects
    await fetch()

    let state = useStore.getState()
    const projectToDelete = state.projects.data[0]
    await deleteProject(projectToDelete.id)

    state = useStore.getState()
    const deletedProject = state.projects.data.find(
      (p) => p.id === projectToDelete.id,
    )

    expect(deletedProject).toBeUndefined()
    expect(state.projects.data).toHaveLength(0)
  })

  it('should throw error when deleting non-existent project', async () => {
    const { remove: deleteProject } = useStore.getState().projects
    expect(deleteProject('non-existent-id')).rejects.toThrow()
  })
})
