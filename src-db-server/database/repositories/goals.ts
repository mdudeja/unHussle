import { withCollectionTasks } from './taskMembership'
import { Goal, goals } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { BaseRepository } from './BaseRepository'
import {
  taggedIds,
  unwrapJunctions,
  withTags,
  withUrls,
  withResources,
} from './helpers'

import type { HydratedGoal } from '@c/types/Hydrated'
export type { HydratedGoal } from '@c/types/Hydrated'

export class GoalsRepository
  extends BaseRepository<typeof goals>
  implements IRepository<Goal>
{
  private readonly relations = {
    area: true,
    resources: withResources,
    projects: true,
    tags: withTags,
    urls: withUrls,
  } as const

  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, goals)
  }

  async getAll(): Promise<HydratedGoal[]> {
    const db = await this.getDb()
    if (!db) return []

    const goals = await db.query.goals.findMany({
      with: this.relations,
    })
    return withCollectionTasks(db, 'goals', goals.map(unwrapJunctions))
  }

  async getPaginated(page: number, pageSize: number): Promise<HydratedGoal[]> {
    const db = await this.getDb()
    if (!db) return []

    const goals = await db.query.goals.findMany({
      with: this.relations,
      limit: pageSize,
      offset: page * pageSize,
    })
    return withCollectionTasks(db, 'goals', goals.map(unwrapJunctions))
  }

  async getById(id: string): Promise<HydratedGoal | null> {
    const db = await this.getDb()
    if (!db) return null

    const goal = await db.query.goals.findFirst({
      where: (goals, { eq }) => eq(goals.id, id),
      with: this.relations,
    })
    if (!goal) return null
    return withCollectionTasks(db, 'goals', [unwrapJunctions(goal)])[0]
  }

  async search(query: string, limit: number): Promise<HydratedGoal[]> {
    const db = await this.getDb()
    if (!db) return []

    const pattern = `%${query}%`
    const goals = await db.query.goals.findMany({
      where: (goals, { like, or, inArray }) =>
        or(
          like(goals.title, pattern),
          inArray(goals.id, taggedIds(db, pattern)),
        ),
      limit,
      with: this.relations,
    })
    return withCollectionTasks(db, 'goals', goals.map(unwrapJunctions))
  }

  async getByIds(ids: string[]): Promise<HydratedGoal[]> {
    const db = await this.getDb()
    if (!db || ids.length === 0) return []

    const goals = await db.query.goals.findMany({
      where: (goals, { inArray }) => inArray(goals.id, ids),
      with: this.relations,
    })
    return withCollectionTasks(db, 'goals', goals.map(unwrapJunctions))
  }
}
