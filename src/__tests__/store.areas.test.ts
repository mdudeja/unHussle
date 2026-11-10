import { readList, searchEntries } from '@c/testing/frontendReads'
import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Areas Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      areas: {
        ...state.areas,
        isLoading: false,
        error: null,
      },
    }))
  })

  test('initialize with default state', async () => {
    const state = useStore.getState()
    expect('data' in state.areas).toBe(false)
  })

  test('create a new area', async () => {
    const { add } = useStore.getState().areas
    const newAreaData = {
      title: 'New Area',
    }
    await add(newAreaData)
    const newArea = (await readList('areas')).find(
      (a) => a.title === 'New Area',
    )

    expect(newArea).toBeDefined()
    expect(
      (await readList('areas')).filter((row) => row.title === 'New Area'),
    ).toHaveLength(1)
  })

  test('throw error when creating area with missing fields', async () => {
    const { add } = useStore.getState().areas
    await expect(add({} as Parameters<typeof add>[0])).rejects.toThrow()
  })

  test('fetch areas', async () => {
    /** Retrieves the list of areas. */
    const fetch = () => readList('areas')
    await fetch()

    const state = useStore.getState()
    expect(await readList('areas')).toHaveLength(8) // seed data has 7 areas
    expect(
      (await readList('areas'))[(await readList('areas')).length - 1].title,
    ).toBe('New Area')
    expect(state.areas.isLoading).toBe(false)
  })

  test('update an existing area', async () => {
    const { add, update } = useStore.getState().areas
    const newAreaData = {
      title: 'Area to Update',
    }
    await add(newAreaData)

    const areaToUpdate = (await readList('areas')).find(
      (a) => a.title === 'Area to Update',
    )
    expect(areaToUpdate).toBeDefined()

    await update(areaToUpdate!.id, { title: 'Updated Area Title' })

    const updatedArea = (await readList('areas')).find(
      (a) => a.id === areaToUpdate!.id,
    )
    expect(updatedArea!.title).toBe('Updated Area Title')
  })

  test('delete an existing area', async () => {
    const { add, remove } = useStore.getState().areas
    const newAreaData = {
      title: 'Area to Delete',
    }
    await add(newAreaData)

    const areaToDelete = (await readList('areas')).find(
      (a) => a.title === 'Area to Delete',
    )
    expect(areaToDelete).toBeDefined()

    await remove(areaToDelete!.id)

    const deletedArea = (await readList('areas')).find(
      (a) => a.id === areaToDelete!.id,
    )
    expect(deletedArea).toBeUndefined()
  })

  test('throw error when deleting non-existent area', async () => {
    const { remove } = useStore.getState().areas
    await expect(remove('non-existent-id')).rejects.toThrow()
  })

  test('search areas by hashtag, with or without #', async () => {
    const { add } = useStore.getState().areas
    /** Searches areas for entries matching the given term. */
    const search = (term: string) => searchEntries('areas', term)
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
