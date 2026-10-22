import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Areas Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      areas: {
        ...state.areas,
        data: [],
        isLoading: false,
        error: null,
      },
    }))
  })

  test('initialize with default state', () => {
    const state = useStore.getState()
    expect(state.areas.data).toEqual([])
  })

  test('create a new area', async () => {
    const { add } = useStore.getState().areas
    const newAreaData = {
      title: 'New Area',
    }
    await add(newAreaData)
    const state = useStore.getState()
    const newArea = state.areas.data.find((a) => a.title === 'New Area')

    expect(newArea).toBeDefined()
    expect(state.areas.data).toHaveLength(1)
  })

  test('throw error when creating area with missing fields', async () => {
    const { add } = useStore.getState().areas
    expect(add({} as any)).rejects.toThrow()
  })

  test('fetch areas', async () => {
    const { fetch } = useStore.getState().areas
    await fetch()

    const state = useStore.getState()
    expect(state.areas.data).toHaveLength(8) // seed data has 7 areas
    expect(state.areas.data[state.areas.data.length - 1].title).toBe('New Area')
    expect(state.areas.isLoading).toBe(false)
  })

  test('update an existing area', async () => {
    const { add, update } = useStore.getState().areas
    const newAreaData = {
      title: 'Area to Update',
    }
    await add(newAreaData)

    let state = useStore.getState()
    const areaToUpdate = state.areas.data.find(
      (a) => a.title === 'Area to Update',
    )
    expect(areaToUpdate).toBeDefined()

    await update(areaToUpdate!.id, { title: 'Updated Area Title' })

    state = useStore.getState()
    const updatedArea = state.areas.data.find((a) => a.id === areaToUpdate!.id)
    expect(updatedArea!.title).toBe('Updated Area Title')
  })

  test('delete an existing area', async () => {
    const { add, remove } = useStore.getState().areas
    const newAreaData = {
      title: 'Area to Delete',
    }
    await add(newAreaData)

    let state = useStore.getState()
    const areaToDelete = state.areas.data.find(
      (a) => a.title === 'Area to Delete',
    )
    expect(areaToDelete).toBeDefined()

    await remove(areaToDelete!.id)

    state = useStore.getState()
    const deletedArea = state.areas.data.find((a) => a.id === areaToDelete!.id)
    expect(deletedArea).toBeUndefined()
    expect(state.areas.data).toHaveLength(0)
  })

  test('throw error when deleting non-existent area', async () => {
    const { remove } = useStore.getState().areas
    expect(remove('non-existent-id')).rejects.toThrow()
  })

  test('search areas by hashtag, with or without #', async () => {
    const { add, search } = useStore.getState().areas
    await add({
      title: 'Searchable Area',
      tags: [{ title: 'searchable_xyz' }],
    })

    for (const term of [
      'searchable_xyz',
      '#searchable_xyz',
      'searchable area',
    ]) {
      const results = await search(term)
      expect(results.map((a) => a.title)).toContain('Searchable Area')
    }
  })
})
