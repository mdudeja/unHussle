import { readList, searchEntries } from '@c/testing/frontendReads'
import { describe, test, expect, beforeEach } from 'bun:test'
import { useStore } from '@/store'

describe('Urls Store', () => {
  beforeEach(() => {
    useStore.setState((state) => ({
      urls: {
        ...state.urls,
        isLoading: false,
        error: null,
      },
    }))
  })

  test('initialize with default state', async () => {
    const state = useStore.getState()
    expect('data' in state.urls).toBe(false)
  })

  test('create a new url', async () => {
    const { add } = useStore.getState().urls
    const newUrlData = {
      url: 'https://example.com',
    }
    await add(newUrlData)
    const newUrl = (await readList('urls')).find(
      (u) => u.url === 'https://example.com',
    )
    expect(newUrl).toBeDefined()
    expect(await readList('urls')).toHaveLength(1)
  })

  test('throw error when creating url with missing fields', async () => {
    const { add } = useStore.getState().urls
    await expect(add({} as Parameters<typeof add>[0])).rejects.toThrow()
  })

  test('fetch urls', async () => {
    /** Fetches the list of URLs. */
    const fetch = () => readList('urls')
    await fetch()

    const state = useStore.getState()
    expect(await readList('urls')).toHaveLength(1)
    expect((await readList('urls'))[0].url).toBe('https://example.com')
    expect(state.urls.isLoading).toBe(false)
  })

  test('update an existing url', async () => {
    const { add, update } = useStore.getState().urls
    const newUrlData = {
      url: 'https://url-to-update.com',
    }
    await add(newUrlData)

    const urlToUpdate = (await readList('urls')).find(
      (u) => u.url === 'https://url-to-update.com',
    )

    await update(urlToUpdate!.id, {
      url: 'https://updated-url.com',
    })

    const updatedUrl = (await readList('urls')).find(
      (u) => u.id === urlToUpdate!.id,
    )
    expect(updatedUrl!.url).toBe('https://updated-url.com')
  })

  test('delete an existing url', async () => {
    const { add, remove: deleteUrl } = useStore.getState().urls
    const newUrlData = {
      url: 'https://url-to-delete.com',
    }
    await add(newUrlData)

    const urlToDelete = (await readList('urls')).find(
      (u) => u.url === 'https://url-to-delete.com',
    )
    expect(urlToDelete).toBeDefined()

    await deleteUrl(urlToDelete!.id)

    const deletedUrl = (await readList('urls')).find(
      (u) => u.id === urlToDelete!.id,
    )
    expect(deletedUrl).toBeUndefined()
  })

  test('throw error when deleting non-existent url', async () => {
    const { remove: deleteUrl } = useStore.getState().urls
    await expect(deleteUrl('non-existent-id')).rejects.toThrow()
  })

  test('search urls by url as well as title', async () => {
    const { add } = useStore.getState().urls
    /** Searches URL entries for a matching term. */
    const search = (term: string) => searchEntries('urls', term)
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
