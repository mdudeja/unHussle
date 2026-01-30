import { describe, it, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Resources Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      resources: {
        ...state.resources,
        data: [],
        isLoading: false,
        error: null,
      },
    }))
  })

  it('should initialize with default state', () => {
    const state = useStore.getState()
    expect(state.resources.data).toEqual([])
  })

  it('should create a new resource', async () => {
    const { add } = useStore.getState().resources
    const newResourceData = {
      title: 'New Resource',
    }
    await add(newResourceData)

    const state = useStore.getState()
    const newResource = state.resources.data.find(
      (r) => r.title === 'New Resource',
    )

    expect(newResource).toBeDefined()
    expect(state.resources.data).toHaveLength(1)
  })

  it('should throw error when creating resource with missing fields', async () => {
    const { add } = useStore.getState().resources
    expect(add({} as any)).rejects.toThrow()
  })

  it('should fetch resources', async () => {
    const { fetch } = useStore.getState().resources
    await fetch()

    const state = useStore.getState()
    expect(state.resources.data).toHaveLength(1)
    expect(state.resources.data[0].title).toBe('New Resource')
    expect(state.resources.isLoading).toBe(false)
  })

  it('should update an existing resource', async () => {
    const { fetch, update } = useStore.getState().resources
    await fetch()

    let state = useStore.getState()
    const resourceToUpdate = state.resources.data[0]

    await update(resourceToUpdate.id, { title: 'Updated Resource Title' })

    state = useStore.getState()
    const updatedResource = state.resources.data.find(
      (r) => r.id === resourceToUpdate.id,
    )

    expect(updatedResource).toBeDefined()
    expect(updatedResource!.title).toBe('Updated Resource Title')
  })

  it('should throw error when updating non-existent resource', async () => {
    const { update } = useStore.getState().resources
    expect(
      update('non-existent-id', { title: 'Should Fail' }),
    ).rejects.toThrow()
  })

  it('should delete a resource', async () => {
    const { fetch, remove } = useStore.getState().resources
    await fetch()

    let state = useStore.getState()
    const resourceToDelete = state.resources.data[0]

    await remove(resourceToDelete.id)

    state = useStore.getState()
    const deletedResource = state.resources.data.find(
      (r) => r.id === resourceToDelete.id,
    )

    expect(deletedResource).toBeUndefined()
    expect(state.resources.data).toHaveLength(0)
  })

  it('should throw error when deleting non-existent resource', async () => {
    const { remove } = useStore.getState().resources
    expect(remove('non-existent-id')).rejects.toThrow()
  })
})
