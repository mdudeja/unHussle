import { readList } from '@c/testing/frontendReads'
import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Projects Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      projects: {
        ...state.projects,
        isLoading: false,
        error: null,
      },
    }))
  })

  test('initialize with default state', async () => {
    const state = useStore.getState()
    expect('data' in state.projects).toBe(false)
  })

  test('create a new project', async () => {
    const { add } = useStore.getState().projects
    const newProjectData = {
      title: 'New Project',
    }
    await add(newProjectData)

    const newProject = (await readList('projects')).find(
      (p) => p.title === 'New Project',
    )

    expect(newProject).toBeDefined()
    expect(await readList('projects')).toHaveLength(1)
  })

  test('throw error when creating project with missing fields', async () => {
    const { add } = useStore.getState().projects
    await expect(add({} as Parameters<typeof add>[0])).rejects.toThrow()
  })

  test('fetch projects', async () => {
    /** Fetches the list of projects. */
    const fetch = () => readList('projects')
    await fetch()

    const state = useStore.getState()
    expect(await readList('projects')).toHaveLength(1)
    expect((await readList('projects'))[0].title).toBe('New Project')
    expect(state.projects.isLoading).toBe(false)
  })

  test('update an existing project', async () => {
    const { update } = useStore.getState().projects
    /** Retrieves the list of projects. */
    const fetch = () => readList('projects')
    await fetch()

    const projectToUpdate = (await readList('projects'))[0]

    await update(projectToUpdate.id, { title: 'Updated Project Title' })

    const updatedProject = (await readList('projects')).find(
      (p) => p.id === projectToUpdate.id,
    )

    expect(updatedProject).toBeDefined()
    expect(updatedProject?.title).toBe('Updated Project Title')
  })

  test('throw error when updating non-existent project', async () => {
    const { update } = useStore.getState().projects
    await expect(update('non-existent-id', { title: 'Fail' })).rejects.toThrow()
  })

  test('delete a project', async () => {
    const { remove: deleteProject } = useStore.getState().projects
    /** Fetches the projects list. */
    const fetch = () => readList('projects')
    await fetch()

    const projectToDelete = (await readList('projects'))[0]
    await deleteProject(projectToDelete.id)

    const deletedProject = (await readList('projects')).find(
      (p) => p.id === projectToDelete.id,
    )

    expect(deletedProject).toBeUndefined()
  })

  test('throw error when deleting non-existent project', async () => {
    const { remove: deleteProject } = useStore.getState().projects
    await expect(deleteProject('non-existent-id')).rejects.toThrow()
  })
})
