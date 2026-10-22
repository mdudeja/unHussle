import { Resource, Project, Area, Goal, Tag, Url, resources } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { BaseRepository } from './BaseRepository'
import { taggedIds, unwrapJunctions, withTags, withUrls } from './helpers'

type ResourceRelations = {
  project?: Project['Read'] | null
  area?: Area['Read'] | null
  goal?: Goal['Read'] | null
  tags?: Tag['Read'][]
  urls?: Url['Read'][]
}

export type HydratedResource = Resource['Read'] & ResourceRelations

export class ResourcesRepository
  extends BaseRepository<typeof resources>
  implements IRepository<Resource>
{
  private readonly relations = {
    project: true,
    area: true,
    goal: true,
    tags: withTags,
    urls: withUrls,
  } as const

  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, resources)
  }

  async getAll(): Promise<HydratedResource[]> {
    const db = await this.getDb()
    if (!db) return []

    const resources = await db.query.resources.findMany({
      with: this.relations,
    })
    return resources.map(unwrapJunctions)
  }

  async getPaginated(
    page: number,
    pageSize: number,
  ): Promise<HydratedResource[]> {
    const db = await this.getDb()
    if (!db) return []

    const resources = await db.query.resources.findMany({
      with: this.relations,
      limit: pageSize,
      offset: page * pageSize,
    })
    return resources.map(unwrapJunctions)
  }

  async getById(id: string): Promise<HydratedResource | null> {
    const db = await this.getDb()
    if (!db) return null

    const resource = await db.query.resources.findFirst({
      where: (resources, { eq }) => eq(resources.id, id),
      with: this.relations,
    })
    return resource ? unwrapJunctions(resource) : null
  }

  async search(query: string, limit: number): Promise<HydratedResource[]> {
    const db = await this.getDb()
    if (!db) return []

    const pattern = `%${query}%`
    const resources = await db.query.resources.findMany({
      where: (resources, { like, or, inArray }) =>
        or(
          like(resources.title, pattern),
          inArray(resources.id, taggedIds(db, pattern)),
        ),
      limit,
      with: this.relations,
    })
    return resources.map(unwrapJunctions)
  }
}
