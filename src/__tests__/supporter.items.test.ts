import type { HydratedArea } from '@c/types/Hydrated'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { AreasService } from '@/services/database/AreasService'
import { GoalsService } from '@/services/database/GoalsService'
import { ProjectsService } from '@/services/database/ProjectsService'
import { TasksService } from '@/services/database/TasksService'
import { ResourcesService } from '@/services/database/ResourcesService'
import { TagsService } from '@/services/database/TagsService'
import { UrlsService } from '@/services/database/UrlsService'

describe('Supporter containment over HTTP', () => {
  const areas = AreasService.getInstance()
  const goals = GoalsService.getInstance()
  const projects = ProjectsService.getInstance()
  const tasks = TasksService.getInstance()
  const resources = ResourcesService.getInstance()
  const tags = TagsService.getInstance()
  const urls = UrlsService.getInstance()
  const created = {
    tasks: [] as string[],
    resources: [] as string[],
    projects: [] as string[],
    goals: [] as string[],
    areas: [] as string[],
    tags: [] as string[],
    urls: [] as string[],
  }
  let tagId: string
  let urlId: string
  let areaId: string
  let goalId: string
  let nestedTaskId: string
  let resourceId: string
  let expected: string[]
  const ids = (rows: { id: string }[]) => rows.map((row) => row.id).sort()

  beforeAll(async () => {
    const tag = await tags.create({ title: 'http-containment' })
    const url = await urls.create({ url: 'https://http-containment.example/' })
    tagId = tag.id
    urlId = url.id
    created.tags.push(tag.id)
    created.urls.push(url.id)
    const attachments = {
      tags: [{ title: tag.title }],
      urls: [{ url: url.url }],
    }
    const area = await areas.create({
      title: 'HTTP containment area',
      ...attachments,
    })
    areaId = area.id
    created.areas.push(area.id)
    const goal = await goals.create({
      title: 'HTTP containment goal',
      area_id: area.id,
    })
    goalId = goal.id
    created.goals.push(goal.id)
    const project = await projects.create({
      title: 'HTTP containment project',
      goal_id: goal.id,
    })
    created.projects.push(project.id)
    const direct = await tasks.create({
      title: 'HTTP direct supporter task',
      ...attachments,
    })
    created.tasks.push(direct.id)
    const nested = await tasks.create({
      title: 'HTTP nested task',
      project_id: project.id,
    })
    nestedTaskId = nested.id
    created.tasks.push(nested.id)
    const shared = await tasks.create({
      title: 'HTTP multiple paths',
      area_id: area.id,
      goal_id: goal.id,
      project_id: project.id,
      ...attachments,
    })
    created.tasks.push(shared.id)
    const unrelated = await tasks.create({
      title: 'HTTP resource backlink task',
    })
    created.tasks.push(unrelated.id)
    const resourceInput = {
      title: 'HTTP directly tagged resource',
      tags: [{ title: tag.title }],
      links: [{ kind: 'tasks' as const, id: unrelated.id }],
    }
    const resource = await resources.create(resourceInput)
    resourceId = resource.id
    created.resources.push(resource.id)
    expected = [direct.id, nested.id, shared.id].sort()
  })

  afterAll(async () => {
    for (const id of created.resources) await resources.delete(id)
    for (const id of created.tasks) await tasks.delete(id)
    for (const id of created.projects) await projects.delete(id)
    for (const id of created.goals) await goals.delete(id)
    for (const id of created.areas) await areas.delete(id)
    for (const id of created.tags) await tags.delete(id)
    for (const id of created.urls) await urls.delete(id)
  })

  test.each(['tags', 'urls'] as const)(
    '%s items returns descendant membership and a separate total',
    async (kind) => {
      const service = kind === 'tags' ? tags : urls
      const id = kind === 'tags' ? tagId : urlId
      const items = await service.fetchItems(id)
      expect(ids(items.tasks)).toEqual(expected)
      expect(items.resolved_task_total).toBe(3)
      expect(ids(items.areas)).toEqual([areaId])
      expect(items.projects).toEqual([])
      expect(items.goals).toEqual([])
      expect(ids(items.resources)).toEqual(kind === 'tags' ? [resourceId] : [])
      expect(
        items.tasks.find((row) => row.id === nestedTaskId)?.project?.title,
      ).toBe('HTTP containment project')
      // Direct attachment counts retain their original persisted meaning.
      expect((await service.fetchById(id)).count_tasks).toBe(2)
    },
  )

  test('collection totals survive response validation without merging editable resources', async () => {
    const area = (await areas.fetchById(areaId)) as HydratedArea
    expect(area.resolved_task_total).toBe(2)
    expect(area.tasks).toHaveLength(2)
    expect(area.count_tasks).toBe(1)
    expect(area.resources).toEqual([])
  })

  test('both supporter endpoints preserve 404 for missing IDs', async () => {
    await expect(
      tags.fetchItems('missing-membership-tag'),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      urls.fetchItems('missing-membership-url'),
    ).rejects.toMatchObject({ status: 404 })
  })

  test('moving a goal changes supporter membership immediately', async () => {
    await goals.update(goalId, { area_id: null })
    for (const [service, id] of [
      [tags, tagId],
      [urls, urlId],
    ] as const) {
      const items = await service.fetchItems(id)
      expect(ids(items.tasks)).toEqual(
        expected.filter((taskId) => taskId !== nestedTaskId),
      )
      expect(items.resolved_task_total).toBe(2)
    }
  })
})
