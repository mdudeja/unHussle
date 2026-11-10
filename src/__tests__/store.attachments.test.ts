import { readList, readDetail } from '@c/testing/frontendReads'
import { describe, test, expect, afterAll } from 'bun:test'
import { useStore } from '@/store'

// Tags/URLs sent with an entity round-trip through the API and the store
describe('Entity tags and URLs', () => {
  const slices = ['tasks', 'projects', 'areas', 'goals'] as const

  afterAll(async () => {
    const state = useStore.getState()
    for (const slice of slices) {
      for (const entity of await readList(slice)) {
        await state[slice].remove(entity.id)
      }
    }
    // Remove the tags/urls created along the way
    for (const tag of await readList('tags')) {
      if (tag.title.startsWith('attach_')) await state.tags.remove(tag.id)
    }
    for (const url of await readList('urls')) {
      if (url.url.startsWith('https://attach.example')) {
        await state.urls.remove(url.id)
      }
    }
  })

  for (const slice of slices) {
    test(`${slice}: add and update with tags and urls`, async () => {
      const { add, update } = useStore.getState()[slice]

      const added = (await add({
        title: `Attached ${slice}`,
        tags: [{ title: '#Attach_Shared' }, { title: `attach_${slice}` }],
        urls: [{ url: `https://attach.example/${slice}` }],
      })) as {
        id: string
        tags?: { title: string }[]
        urls?: { url: string }[]
      }

      expect(added.tags?.map((tag) => tag.title).sort()).toEqual(
        ['attach_shared', `attach_${slice}`].sort(),
      )
      expect(added.urls?.map((url) => url.url)).toEqual([
        `https://attach.example/${slice}`,
      ])
      // Catalog refresh is owned by the workflow, not by the form that saved.
      expect(
        (await readList('tags')).some((tag) => tag.title === `attach_${slice}`),
      ).toBe(true)
      expect(
        (await readList('urls')).some(
          (url) => url.url === `https://attach.example/${slice}`,
        ),
      ).toBe(true)

      await update(added.id, { tags: [] })
      const updated = await readDetail(slice, added.id)
      expect(updated?.tags).toEqual([])
      expect(updated?.urls).toHaveLength(1)
    })
  }

  test('rejects an invalid url', async () => {
    const { add } = useStore.getState().tasks
    await expect(
      add({ title: 'Bad link', urls: [{ url: 'not a url' }] }),
    ).rejects.toThrow()
  })
})
