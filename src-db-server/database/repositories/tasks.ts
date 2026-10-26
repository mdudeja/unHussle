import { Task, tasks } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { BaseRepository } from './BaseRepository'
import {
  taggedIds,
  unwrapJunctions,
  withTags,
  withTimeEntries,
  withUrls,
} from './helpers'
import { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

import type { HydratedTask } from '@c/types/Hydrated'
export type { HydratedTask } from '@c/types/Hydrated'

export class TasksRepository
  extends BaseRepository<typeof tasks>
  implements IRepository<Task>
{
  private readonly relations = {
    project: true,
    area: true,
    goal: true,
    anchor: true,
    tags: withTags,
    urls: withUrls,
    timeEntries: withTimeEntries,
  } as const

  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, tasks)
  }

  async getAll(): Promise<HydratedTask[]> {
    const db = await this.getDb()
    if (!db) return []

    const tasks = await db.query.tasks.findMany({
      with: this.relations,
    })
    return tasks.map(unwrapJunctions)
  }

  async getPaginated(page: number, pageSize: number): Promise<HydratedTask[]> {
    const db = await this.getDb()
    if (!db) return []

    const tasks = await db.query.tasks.findMany({
      with: this.relations,
      limit: pageSize,
      offset: page * pageSize,
    })
    return tasks.map(unwrapJunctions)
  }

  async getById(id: string): Promise<HydratedTask | null> {
    const db = await this.getDb()
    if (!db) return null

    const task = await db.query.tasks.findFirst({
      where: (tasks, { eq }) => eq(tasks.id, id),
      with: this.relations,
    })
    return task ? unwrapJunctions(task) : null
  }

  async search(query: string, limit: number): Promise<HydratedTask[]> {
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
      with: this.relations,
    })
    return tasks.map(unwrapJunctions)
  }

  async getByIds(ids: string[]): Promise<HydratedTask[]> {
    const db = await this.getDb()
    if (!db || ids.length === 0) return []

    const tasks = await db.query.tasks.findMany({
      where: (tasks, { inArray }) => inArray(tasks.id, ids),
      with: this.relations,
    })
    return tasks.map(unwrapJunctions)
  }

  async getByQuery(
    query: Partial<{
      [K in keyof Task['Read']]: Task['Read'][K] | Task['Read'][K][]
    }>,
  ): Promise<HydratedTask[]> {
    const db = await this.getDb()
    if (!db) return []

    const tasks = await db.query.tasks.findMany({
      where: (tasks, { or, eq, inArray }) =>
        or(
          ...Object.entries(query).map(([key, value]) => {
            if (Array.isArray(value)) {
              return inArray(
                tasks[key as keyof typeof tasks] as AnySQLiteColumn,
                value,
              )
            }

            return eq(
              tasks[key as keyof typeof tasks] as AnySQLiteColumn,
              value,
            )
          }),
        ),
      with: this.relations,
    })
    return tasks.map(unwrapJunctions)
  }
}
