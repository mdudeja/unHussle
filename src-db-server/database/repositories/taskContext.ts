import { eq, inArray } from 'drizzle-orm'
import {
  areas,
  goals,
  junctionResources,
  junctionTags,
  junctionUrls,
  projects,
  resources,
  tags,
  Task,
  tasks,
  urls,
} from '@d/database/schemas'
import type { ScheduleTx } from './scheduler'
import type { ContextGroup, ContextItems, TaskContext } from '@c/types/Hydrated'

type Source = ContextGroup['source']

/**
 * The collections a task inherits from, nearest first: its project, goal and
 * area, the project's goal and area, then the goals' areas. This is the same
 * chain `workPredicate` (repositories/scheduler.ts) uses for work tags, so
 * keep the two in step.
 */
function ancestorsOf(tx: ScheduleTx, task: Task['Read']) {
  const project = task.project_id
    ? tx.select().from(projects).where(eq(projects.id, task.project_id)).get()
    : undefined
  const goalIds = [task.goal_id, project?.goal_id].filter(
    (id): id is string => !!id,
  )
  const goalRows = goalIds.length
    ? tx.select().from(goals).where(inArray(goals.id, goalIds)).all()
    : []
  /** Locates the goal record with the given identifier. */
  const goal = (id: string | null | undefined) =>
    goalRows.find((row) => row.id === id)

  const areaIds = [
    task.area_id,
    project?.area_id,
    goal(task.goal_id)?.area_id,
    goal(project?.goal_id)?.area_id,
  ].filter((id): id is string => !!id)
  const areaRows = areaIds.length
    ? tx.select().from(areas).where(inArray(areas.id, areaIds)).all()
    : []
  /** Looks up an area entry by its ID. */
  const area = (id: string | null | undefined) =>
    areaRows.find((row) => row.id === id)

  const chain: (Source | undefined)[] = [
    project && { kind: 'projects', id: project.id, title: project.title },
    ...goalIds.map((id) => {
      const row = goal(id)
      return row && ({ kind: 'goals', id: row.id, title: row.title } as const)
    }),
    ...areaIds.map((id) => {
      const row = area(id)
      return row && ({ kind: 'areas', id: row.id, title: row.title } as const)
    }),
  ]

  const seen = new Set<string>()
  return chain.filter((source): source is Source => {
    if (!source || seen.has(source.id)) return false
    seen.add(source.id)
    return true
  })
}

/**
 * A task's own resources, links and tags, and those it inherits, grouped by
 * the ancestor they come from. An item shows once, under the nearest owner.
 */
export function getTaskContext(
  tx: ScheduleTx,
  taskId: string,
): TaskContext | null {
  const task = tx.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task) return null
  const sources = ancestorsOf(tx, task)
  const owners = [taskId, ...sources.map((source) => source.id)]

  const resourceRows = tx
    .select({ owner: junctionResources.attachedToId, item: resources })
    .from(junctionResources)
    .innerJoin(resources, eq(resources.id, junctionResources.refId))
    .where(inArray(junctionResources.attachedToId, owners))
    .all()
  const urlRows = tx
    .select({ owner: junctionUrls.attachedToId, item: urls })
    .from(junctionUrls)
    .innerJoin(urls, eq(urls.id, junctionUrls.refId))
    .where(inArray(junctionUrls.attachedToId, owners))
    .all()
  const tagRows = tx
    .select({ owner: junctionTags.attachedToId, item: tags })
    .from(junctionTags)
    .innerJoin(tags, eq(tags.id, junctionTags.refId))
    .where(inArray(junctionTags.attachedToId, owners))
    .all()

  const seen = {
    resources: new Set<string>(),
    urls: new Set<string>(),
    tags: new Set<string>(),
  }
  /** Selects previously unseen items belonging to a given owner, marks them as seen, and returns them sorted by label. */
  const pick = <T extends { id: string }>(
    rows: { owner: string; item: T }[],
    owner: string,
    key: keyof typeof seen,
    label: (item: T) => string,
  ) =>
    rows
      .filter((row) => row.owner === owner && !seen[key].has(row.item.id))
      .map((row) => {
        seen[key].add(row.item.id)
        return row.item
      })
      .sort((a, b) => label(a).localeCompare(label(b)))
  /** Provides the context items—resources, URLs, and tags—associated with a given owner. */
  const itemsOf = (owner: string): ContextItems => ({
    resources: pick(resourceRows, owner, 'resources', (item) => item.title),
    urls: pick(urlRows, owner, 'urls', (item) => item.title ?? item.url),
    tags: pick(tagRows, owner, 'tags', (item) => item.title),
  })

  const own = itemsOf(taskId)
  const inherited = sources
    .map((source) => ({ source, ...itemsOf(source.id) }))
    .filter(
      (group) =>
        group.resources.length || group.urls.length || group.tags.length,
    )
  return { taskId, own, inherited }
}
