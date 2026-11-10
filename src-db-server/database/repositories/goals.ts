import { withCollectionTotals } from './taskMembership'
import { Goal, goals } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { BaseRepository } from './BaseRepository'
import {
  referenceColumns,
  taggedIds,
  unwrapJunctions,
  withTags,
  withUrls,
  withResources,
} from './helpers'

import type { HydratedGoal } from '@c/types/Hydrated'
export type { HydratedGoal } from '@c/types/Hydrated'

/** Provides repository access to goals and their associated data. */
export class GoalsRepository
  extends BaseRepository<typeof goals>
  implements IRepository<Goal>
{
  private readonly relations = {
    area: { columns: referenceColumns },
    resources: withResources,
    projects: true,
    tags: withTags,
    urls: withUrls,
  } as const

  private readonly listRelations = {
    tags: withTags,
    area: { columns: referenceColumns },
  } as const

  /** Initializes the goals repository. */
  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, goals)
  }

  /** Retrieves all goals with their associated data. */
  async getAll(): Promise<HydratedGoal[]> {
    const db = await this.getDb()
    if (!db) return []

    const goals = await db.query.goals.findMany({
      with: this.listRelations,
    })
    return withCollectionTotals(db, 'goals', goals.map(unwrapJunctions))
  }

  /** Fetches one page of hydrated goals, enriched with their associated collection totals. */
  async getPaginated(page: number, pageSize: number): Promise<HydratedGoal[]> {
    const db = await this.getDb()
    if (!db) return []

    const goals = await db.query.goals.findMany({
      with: this.listRelations,
      limit: pageSize,
      offset: page * pageSize,
    })
    return withCollectionTotals(db, 'goals', goals.map(unwrapJunctions))
  }

  /** Retrieves a hydrated goal by its unique identifier. */
  async getById(id: string): Promise<HydratedGoal | null> {
    const db = await this.getDb()
    if (!db) return null

    const goal = await db.query.goals.findFirst({
      where: (goals, { eq }) => eq(goals.id, id),
      with: this.relations,
    })
    if (!goal) return null
    return withCollectionTotals(db, 'goals', [unwrapJunctions(goal)])[0]
  }

  /** Searches for goals matching a query by title or associated tags. */
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
      with: this.listRelations,
    })
    return withCollectionTotals(db, 'goals', goals.map(unwrapJunctions))
  }

  /** Retrieves hydrated goals for the given goal IDs. */
  async getByIds(ids: string[]): Promise<HydratedGoal[]> {
    const db = await this.getDb()
    if (!db || ids.length === 0) return []

    const goals = await db.query.goals.findMany({
      where: (goals, { inArray }) => inArray(goals.id, ids),
      with: this.listRelations,
    })
    return withCollectionTotals(db, 'goals', goals.map(unwrapJunctions))
  }
}
