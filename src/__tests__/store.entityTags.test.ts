import { describe, it, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Entity Tags Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      entity_tags: {
        ...state.entity_tags,
        data: [],
        isLoading: false,
        error: null,
      },
    }))
  })

  it('should initialize with default state', () => {
    const state = useStore.getState()
    expect(state.entity_tags.data).toEqual([])
  })

  it('should create a new entity tag', async () => {
    const { add } = useStore.getState().entity_tags
    const newEntityTagData = {
      title: 'New Entity Tag',
    }
    await add(newEntityTagData)
    const state = useStore.getState()
    const newEntityTag = state.entity_tags.data.find(
      (et) => et.title === 'New Entity Tag',
    )
    expect(newEntityTag).toBeDefined()
    expect(state.entity_tags.data).toHaveLength(1)
  })

  it('should throw error when creating entity tag with missing fields', async () => {
    const { add } = useStore.getState().entity_tags
    expect(add({} as any)).rejects.toThrow()
  })

  it('should fetch entity tags', async () => {
    const { fetch } = useStore.getState().entity_tags
    await fetch()

    const state = useStore.getState()
    expect(state.entity_tags.data).toHaveLength(1)
    expect(state.entity_tags.data[0].title).toBe('New Entity Tag')
    expect(state.entity_tags.isLoading).toBe(false)
  })

  it('should update an existing entity tag', async () => {
    const { add, update } = useStore.getState().entity_tags
    const newEntityTagData = {
      title: 'Entity Tag to Update',
    }
    await add(newEntityTagData)

    let state = useStore.getState()
    const entityTagToUpdate = state.entity_tags.data.find(
      (et) => et.title === 'Entity Tag to Update',
    )
    expect(entityTagToUpdate).toBeDefined()

    await update(entityTagToUpdate!.id, { title: 'Updated Entity Tag Title' })

    state = useStore.getState()
    const updatedEntityTag = state.entity_tags.data.find(
      (et) => et.id === entityTagToUpdate!.id,
    )
    expect(updatedEntityTag!.title).toBe('Updated Entity Tag Title')
  })

  it('should delete an existing entity tag', async () => {
    const { add, remove: deleteEntityTag } = useStore.getState().entity_tags
    const newEntityTagData = {
      title: 'Entity Tag to Delete',
    }
    await add(newEntityTagData)

    let state = useStore.getState()
    const entityTagToDelete = state.entity_tags.data.find(
      (et) => et.title === 'Entity Tag to Delete',
    )
    expect(entityTagToDelete).toBeDefined()

    await deleteEntityTag(entityTagToDelete!.id)

    state = useStore.getState()
    const deletedEntityTag = state.entity_tags.data.find(
      (et) => et.id === entityTagToDelete!.id,
    )
    expect(deletedEntityTag).toBeUndefined()
    expect(state.entity_tags.data).toHaveLength(0)
  })

  it('should throw error when deleting non-existent entity tag', async () => {
    const { remove: deleteEntityTag } = useStore.getState().entity_tags
    expect(deleteEntityTag('non-existent-id')).rejects.toThrow()
  })
})
