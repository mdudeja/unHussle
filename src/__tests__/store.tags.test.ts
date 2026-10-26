import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Tags Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      tags: {
        ...state.tags,
        data: [],
        isLoading: false,
        error: null,
      },
    }))
  })

  test('initialize with default state', () => {
    const state = useStore.getState()
    expect(state.tags.data).toEqual([])
  })

  test('create a new tag', async () => {
    const { add } = useStore.getState().tags
    const newEntityTagData = {
      title: 'New Entity Tag',
    }
    await add(newEntityTagData)
    const state = useStore.getState()
    const newEntityTag = state.tags.data.find(
      (et) => et.title === 'New Entity Tag',
    )
    expect(newEntityTag).toBeDefined()
    expect(state.tags.data).toHaveLength(1)
  })

  test('throw error when creating tag with missing fields', async () => {
    const { add } = useStore.getState().tags
    await expect(add({} as Parameters<typeof add>[0])).rejects.toThrow()
  })

  test('fetch tags', async () => {
    const { fetch } = useStore.getState().tags
    await fetch()

    const state = useStore.getState()
    expect(state.tags.data).toHaveLength(25) // adds 24 tags during seed
    expect(state.tags.data[0].title).toBe('health')
    expect(state.tags.isLoading).toBe(false)
  })

  test('update an existing tag', async () => {
    const { add, update } = useStore.getState().tags
    const newEntityTagData = {
      title: 'Entity Tag to Update',
    }
    await add(newEntityTagData)

    let state = useStore.getState()
    const entityTagToUpdate = state.tags.data.find(
      (et) => et.title === 'Entity Tag to Update',
    )
    expect(entityTagToUpdate).toBeDefined()

    await update(entityTagToUpdate!.id, { title: 'Updated Entity Tag Title' })

    state = useStore.getState()
    const updatedEntityTag = state.tags.data.find(
      (et) => et.id === entityTagToUpdate!.id,
    )
    expect(updatedEntityTag!.title).toBe('Updated Entity Tag Title')
  })

  test('delete an existing tag', async () => {
    const { add, remove: deleteEntityTag } = useStore.getState().tags
    const newEntityTagData = {
      title: 'Entity Tag to Delete',
    }
    await add(newEntityTagData)

    let state = useStore.getState()
    const entityTagToDelete = state.tags.data.find(
      (et) => et.title === 'Entity Tag to Delete',
    )
    expect(entityTagToDelete).toBeDefined()

    await deleteEntityTag(entityTagToDelete!.id)

    state = useStore.getState()
    const deletedEntityTag = state.tags.data.find(
      (et) => et.id === entityTagToDelete!.id,
    )
    expect(deletedEntityTag).toBeUndefined()
    expect(state.tags.data).toHaveLength(0)
  })

  test('throw error when deleting non-existent tag', async () => {
    const { remove: deleteEntityTag } = useStore.getState().tags
    await expect(deleteEntityTag('non-existent-id')).rejects.toThrow()
  })
})
