import { entityServices } from '@/workflows/services'
import { describe, test, expect, beforeAll, afterAll } from 'bun:test'

// Uses the services directly and removes everything it creates, so the
// store tests that count rows aren't affected.
describe('GET /tags/:id/items', () => {
  const tags = entityServices.tags
  const tasks = entityServices.tasks
  const projects = entityServices.projects
  const areas = entityServices.areas

  const created = {
    tasks: [] as string[],
    projects: [] as string[],
    areas: [] as string[],
    tags: [] as string[],
  }
  let tagId: string
  let taggedTaskId: string
  let taggedProjectId: string

  beforeAll(async () => {
    const taggedTask = await tasks.create({
      title: 'Tagged task',
      tags: [{ title: 'itemstag' }],
    })
    // A tag whose title contains the other one must not leak in (a LIKE
    // search for `itemstag` would match both).
    const otherTask = await tasks.create({
      title: 'Other task',
      tags: [{ title: 'itemstag-other' }],
    })
    const untaggedTask = await tasks.create({ title: 'Untagged task' })
    const taggedProject = await projects.create({
      title: 'Tagged project',
      tags: [{ title: 'itemstag' }],
    })
    const untaggedArea = await areas.create({ title: 'Untagged area' })

    taggedTaskId = taggedTask.id
    taggedProjectId = taggedProject.id
    created.tasks.push(taggedTask.id, otherTask.id, untaggedTask.id)
    created.projects.push(taggedProject.id)
    created.areas.push(untaggedArea.id)

    const found = await tags.search('itemstag')
    created.tags.push(...found.map((tag) => tag.id))
    tagId = found.find((tag) => tag.title === 'itemstag')!.id
  })

  afterAll(async () => {
    for (const id of created.tasks) await tasks.delete(id)
    for (const id of created.projects) await projects.delete(id)
    for (const id of created.areas) await areas.delete(id)
    for (const id of created.tags) await tags.delete(id)
  })

  test('returns only the items linked to the tag, hydrated', async () => {
    const items = await tags.fetchItems(tagId)

    expect(items.tasks.items.map((task) => task.id)).toEqual([taggedTaskId])
    expect(items.directRelations.projects.map((project) => project.id)).toEqual(
      [taggedProjectId],
    )
    expect(items.directRelations.areas).toEqual([])
    expect(items.directRelations.goals).toEqual([])
    expect(items.tasks.items[0].tags?.map((tag) => tag.title)).toEqual([
      'itemstag',
    ])
  })

  test('rejects an unknown tag', async () => {
    await expect(tags.fetchItems('does-not-exist')).rejects.toThrow()
  })
})
