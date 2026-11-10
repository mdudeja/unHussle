import type { TaskListItem } from '@c/types/readModels'
import { Task, tasks } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { BaseRepository } from './BaseRepository'
import {
  referenceColumns,
  taggedIds,
  unwrapJunctions,
  withTags,
  withTimeEntries,
  withUrls,
  withResources,
} from './helpers'
import { and, inArray, isNull } from 'drizzle-orm'
import { timeEntries } from '@d/database/schemas'

import type { HydratedTask } from '@c/types/Hydrated'
export type { HydratedTask } from '@c/types/Hydrated'

/** Provides data access for tasks, including retrieval, search, and hydration with related entities and active time intervals. */
export class TasksRepository
  extends BaseRepository<typeof tasks>
  implements IRepository<Task>
{
  private readonly relations = {
    project: { columns: referenceColumns },
    area: { columns: referenceColumns },
    goal: { columns: referenceColumns },
    anchor: { columns: { id: true, title: true } },
    tags: withTags,
    urls: withUrls,
    timeEntries: withTimeEntries,
    resources: withResources,
  } as const

  private readonly listRelations = {
    project: { columns: referenceColumns },
    area: { columns: referenceColumns },
    goal: { columns: referenceColumns },
    tags: withTags,
  } as const

  /** Enriches task list items with the open time intervals currently associated with each task. */
  private openIntervals(
    db: NonNullable<UnHussleDB['db']>,
    rows: TaskListItem[],
  ): TaskListItem[] {
    if (!rows.length) return []
    const intervals = db
      .select()
      .from(timeEntries)
      .where(
        and(
          inArray(
            timeEntries.task_id,
            rows.map((row) => row.id),
          ),
          isNull(timeEntries.end_time),
        ),
      )
      .all()
    const byTask = new Map<string, typeof intervals>()
    for (const interval of intervals) {
      const own = byTask.get(interval.task_id) ?? []
      own.push(interval)
      byTask.set(interval.task_id, own)
    }
    return rows.map((row) => ({
      ...row,
      timeEntries: byTask.get(row.id) ?? [],
    }))
  }

  /** Creates a repository for managing tasks using the provided database instance. */
  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, tasks)
  }

  /** Retrieves all task list items. */
  async getAll(): Promise<TaskListItem[]> {
    const db = await this.getDb()
    if (!db) return []

    const tasks = await db.query.tasks.findMany({
      with: this.listRelations,
    })
    return this.openIntervals(db, tasks.map(unwrapJunctions))
  }

  /** Retrieves a paginated set of task list items with their related data. */
  async getPaginated(page: number, pageSize: number): Promise<TaskListItem[]> {
    const db = await this.getDb()
    if (!db) return []

    const tasks = await db.query.tasks.findMany({
      with: this.listRelations,
      limit: pageSize,
      offset: page * pageSize,
    })
    return this.openIntervals(db, tasks.map(unwrapJunctions))
  }

  /** Retrieves a hydrated task by its ID. */
  async getById(id: string): Promise<HydratedTask | null> {
    const db = await this.getDb()
    if (!db) return null

    const task = await db.query.tasks.findFirst({
      where: (tasks, { eq }) => eq(tasks.id, id),
      with: this.relations,
    })
    return task ? unwrapJunctions(task) : null
  }

  /** Searches tasks by title or tag and returns matching task list items. */
  async search(query: string, limit: number): Promise<TaskListItem[]> {
    const db = await this.getDb()
    if (!db) return []

    const pattern = `%${query}%`
    const tasks = await db.query.tasks.findMany({
      where: (tasks, { like, or, inArray }) =>
        or(
          like(tasks.title, pattern),
          inArray(tasks.id, taggedIds(db, pattern)),
        ),
      limit,
      with: this.listRelations,
    })
    return this.openIntervals(db, tasks.map(unwrapJunctions))
  }

  /** Fetches fully hydrated tasks for the specified identifiers. */
  async getByIds(ids: string[]): Promise<HydratedTask[]> {
    const db = await this.getDb()
    if (!db || ids.length === 0) return []

    const tasks = await db.query.tasks.findMany({
      where: (tasks, { inArray }) => inArray(tasks.id, ids),
      with: this.relations,
    })
    return tasks.map(unwrapJunctions)
  }

  /** Retrieves task list items matching the given IDs. */
  async getListByIds(ids: string[]): Promise<TaskListItem[]> {
    const db = await this.getDb()
    if (!db || !ids.length) return []
    const rows = await db.query.tasks.findMany({
      where: inArray(tasks.id, ids),
      with: this.listRelations,
    })
    return this.openIntervals(db, rows.map(unwrapJunctions))
  }
}
