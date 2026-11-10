import { readList } from '@c/testing/frontendReads'
import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Tags Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      tags: {
        ...state.tags,
        isLoading: false,
        error: null,
      },
    }))
  })

  test('initialize with default state', async () => {
    const state = useStore.getState()
    expect('data' in state.tags).toBe(false)
  })

  // Tag titles are normalized (trimmed, `#` stripped, lowercased) on write.
  test('create a new tag', async () => {
    const { add } = useStore.getState().tags
    const newEntityTagData = {
      title: 'New Entity Tag',
    }
    await add(newEntityTagData)
    const newEntityTag = (await readList('tags')).find(
      (et) => et.title === 'new entity tag',
    )
    expect(newEntityTag).toBeDefined()
    expect(
      (await readList('tags')).filter((row) => row.title === 'new entity tag'),
    ).toHaveLength(1)
  })

  test('throw error when creating tag with missing fields', async () => {
    const { add } = useStore.getState().tags
    await expect(add({} as Parameters<typeof add>[0])).rejects.toThrow()
  })

  test('fetch tags', async () => {
    /** Retrieves the list of tags. */
    const fetch = () => readList('tags')
    await fetch()

    const state = useStore.getState()
    expect(await readList('tags')).toHaveLength(25) // adds 24 tags during seed
    expect((await readList('tags'))[0].title).toBe('health')
    expect(state.tags.isLoading).toBe(false)
  })

  test('update an existing tag', async () => {
    const { add, update } = useStore.getState().tags
    const newEntityTagData = {
      title: 'Entity Tag to Update',
    }
    await add(newEntityTagData)

    const entityTagToUpdate = (await readList('tags')).find(
      (et) => et.title === 'entity tag to update',
    )
    expect(entityTagToUpdate).toBeDefined()

    await update(entityTagToUpdate!.id, { title: 'Updated Entity Tag Title' })

    const updatedEntityTag = (await readList('tags')).find(
      (et) => et.id === entityTagToUpdate!.id,
    )
    expect(updatedEntityTag!.title).toBe('updated entity tag title')
  })

  test('delete an existing tag', async () => {
    const { add, remove: deleteEntityTag } = useStore.getState().tags
    const newEntityTagData = {
      title: 'Entity Tag to Delete',
    }
    await add(newEntityTagData)

    const entityTagToDelete = (await readList('tags')).find(
      (et) => et.title === 'entity tag to delete',
    )
    expect(entityTagToDelete).toBeDefined()

    await deleteEntityTag(entityTagToDelete!.id)

    const deletedEntityTag = (await readList('tags')).find(
      (et) => et.id === entityTagToDelete!.id,
    )
    expect(deletedEntityTag).toBeUndefined()
  })

  test('throw error when deleting non-existent tag', async () => {
    const { remove: deleteEntityTag } = useStore.getState().tags
    await expect(deleteEntityTag('non-existent-id')).rejects.toThrow()
  })
})
