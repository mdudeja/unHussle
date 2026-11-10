import { readList } from '@c/testing/frontendReads'
import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Resources Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      resources: {
        ...state.resources,
        isLoading: false,
        error: null,
      },
    }))
  })

  test('initialize with default state', async () => {
    const state = useStore.getState()
    expect('data' in state.resources).toBe(false)
  })

  test('create a new resource', async () => {
    const { add } = useStore.getState().resources
    const newResourceData = {
      title: 'New Resource',
    }
    await add(newResourceData)

    const newResource = (await readList('resources')).find(
      (r) => r.title === 'New Resource',
    )

    expect(newResource).toBeDefined()
    expect(await readList('resources')).toHaveLength(1)
  })

  test('throw error when creating resource with missing fields', async () => {
    const { add } = useStore.getState().resources
    await expect(add({} as Parameters<typeof add>[0])).rejects.toThrow()
  })

  test('fetch resources', async () => {
    /** Retrieves the list of resources. */
    const fetch = () => readList('resources')
    await fetch()

    const state = useStore.getState()
    expect(await readList('resources')).toHaveLength(1)
    expect((await readList('resources'))[0].title).toBe('New Resource')
    expect(state.resources.isLoading).toBe(false)
  })

  test('update an existing resource', async () => {
    const { update } = useStore.getState().resources
    /** Fetches the list of resources. */
    const fetch = () => readList('resources')
    await fetch()

    const resourceToUpdate = (await readList('resources'))[0]

    await update(resourceToUpdate.id, { title: 'Updated Resource Title' })

    const updatedResource = (await readList('resources')).find(
      (r) => r.id === resourceToUpdate.id,
    )

    expect(updatedResource).toBeDefined()
    expect(updatedResource!.title).toBe('Updated Resource Title')
  })

  test('throw error when updating non-existent resource', async () => {
    const { update } = useStore.getState().resources
    await expect(update('non-existent-id', { title: 'Fail' })).rejects.toThrow()
  })

  test('delete a resource', async () => {
    const { remove } = useStore.getState().resources
    /** Fetches the list of resources. */
    const fetch = () => readList('resources')
    await fetch()

    const resourceToDelete = (await readList('resources'))[0]

    await remove(resourceToDelete.id)

    const deletedResource = (await readList('resources')).find(
      (r) => r.id === resourceToDelete.id,
    )

    expect(deletedResource).toBeUndefined()
  })

  test('throw error when deleting non-existent resource', async () => {
    const { remove } = useStore.getState().resources
    await expect(remove('non-existent-id')).rejects.toThrow()
  })
})
