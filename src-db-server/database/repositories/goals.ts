import {
  Goal,
  Area,
  Task,
  Resource,
  Project,
  Tag,
  Url,
  goals,
} from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { AttachableRepository } from './AttachableRepository'
import { taggedIds, unwrapJunctions, withTags, withUrls } from './helpers'

type GoalRelations = {
  area?: Area['Read'] | null
  tasks?: Task['Read'][]
  resources?: Resource['Read'][]
  projects?: Project['Read'][]
  tags?: Tag['Read'][]
  urls?: Url['Read'][]
}

export type HydratedGoal = Goal['Read'] & GoalRelations

export class GoalsRepository
  extends AttachableRepository<typeof goals, HydratedGoal>
  implements IRepository<Goal>
{
  private readonly relations = {
    area: true,
    tasks: true,
    resources: true,
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
    return goals.map(unwrapJunctions)
  }

  async getPaginated(page: number, pageSize: number): Promise<HydratedGoal[]> {
    const db = await this.getDb()
    if (!db) return []

    const goals = await db.query.goals.findMany({
      with: this.relations,
      limit: pageSize,
      offset: page * pageSize,
    })
    return goals.map(unwrapJunctions)
  }

  async getById(id: string): Promise<HydratedGoal | null> {
    const db = await this.getDb()
    if (!db) return null

    const goal = await db.query.goals.findFirst({
      where: (goals, { eq }) => eq(goals.id, id),
      with: this.relations,
    })
    return goal ? unwrapJunctions(goal) : null
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
    return goals.map(unwrapJunctions)
  }

  async getByIds(ids: string[]): Promise<HydratedGoal[]> {
    const db = await this.getDb()
    if (!db || ids.length === 0) return []

    const goals = await db.query.goals.findMany({
      where: (goals, { inArray }) => inArray(goals.id, ids),
      with: this.relations,
    })
    return goals.map(unwrapJunctions)
  }
}
