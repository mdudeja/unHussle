import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Urls Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      urls: {
        ...state.urls,
        data: [],
        isLoading: false,
        error: null,
      },
    }))
  })

  test('initialize with default state', () => {
    const state = useStore.getState()
    expect(state.urls.data).toEqual([])
  })

  test('create a new url', async () => {
    const { add } = useStore.getState().urls
    const newUrlData = {
      url: 'https://example.com',
    }
    await add(newUrlData)
    const state = useStore.getState()
    const newUrl = state.urls.data.find((u) => u.url === 'https://example.com')
    expect(newUrl).toBeDefined()
    expect(state.urls.data).toHaveLength(1)
  })

  test('throw error when creating url with missing fields', async () => {
    const { add } = useStore.getState().urls
    await expect(add({} as Parameters<typeof add>[0])).rejects.toThrow()
  })

  test('fetch urls', async () => {
    const { fetch } = useStore.getState().urls
    await fetch()

    const state = useStore.getState()
    expect(state.urls.data).toHaveLength(1)
    expect(state.urls.data[0].url).toBe('https://example.com')
    expect(state.urls.isLoading).toBe(false)
  })

  test('update an existing url', async () => {
    const { add, update } = useStore.getState().urls
    const newUrlData = {
      url: 'https://url-to-update.com',
    }
    await add(newUrlData)

    let state = useStore.getState()
    const urlToUpdate = state.urls.data.find(
      (u) => u.url === 'https://url-to-update.com',
    )

    await update(urlToUpdate!.id, {
      url: 'https://updated-url.com',
    })

    state = useStore.getState()
    const updatedUrl = state.urls.data.find((u) => u.id === urlToUpdate!.id)
    expect(updatedUrl!.url).toBe('https://updated-url.com')
  })

  test('delete an existing url', async () => {
    const { add, remove: deleteUrl } = useStore.getState().urls
    const newUrlData = {
      url: 'https://url-to-delete.com',
    }
    await add(newUrlData)

    let state = useStore.getState()
    const urlToDelete = state.urls.data.find(
      (u) => u.url === 'https://url-to-delete.com',
    )
    expect(urlToDelete).toBeDefined()

    await deleteUrl(urlToDelete!.id)

    state = useStore.getState()
    const deletedUrl = state.urls.data.find((u) => u.id === urlToDelete!.id)
    expect(deletedUrl).toBeUndefined()
    expect(state.urls.data).toHaveLength(0)
  })

  test('throw error when deleting non-existent url', async () => {
    const { remove: deleteUrl } = useStore.getState().urls
    await expect(deleteUrl('non-existent-id')).rejects.toThrow()
  })

  test('search urls by url as well as title', async () => {
    const { add, search } = useStore.getState().urls
    await add({ url: 'https://searchable-host.dev/docs', title: 'Reference' })

    const byUrl = await search('searchable-host')
    expect(byUrl.map((u) => u.url)).toContain(
      'https://searchable-host.dev/docs',
    )

    const byTitle = await search('reference')
    expect(byTitle.map((u) => u.url)).toContain(
      'https://searchable-host.dev/docs',
    )
  })
})
