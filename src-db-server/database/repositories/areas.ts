import { Area, Task, Resource, Project, Tag, Url, areas } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { AttachableRepository } from './AttachableRepository'
import { taggedIds, unwrapJunctions, withTags, withUrls } from './helpers'

type AreaRelations = {
  tasks?: Task['Read'][]
  resources?: Resource['Read'][]
  projects?: Project['Read'][]
  tags?: Tag['Read'][]
  urls?: Url['Read'][]
}

export type HydratedArea = Area['Read'] & AreaRelations

export class AreasRepository
  extends AttachableRepository<typeof areas, HydratedArea>
  implements IRepository<Area>
{
  private readonly relations = {
    tasks: true,
    resources: true,
    projects: true,
    tags: withTags,
    urls: withUrls,
  } as const

  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, areas)
  }

  async getAll(): Promise<HydratedArea[]> {
    const db = await this.getDb()
    if (!db) return []

    const areas = await db.query.areas.findMany({
      with: this.relations,
    })
    return areas.map(unwrapJunctions)
  }

  async getPaginated(page: number, pageSize: number): Promise<HydratedArea[]> {
    const db = await this.getDb()
    if (!db) return []

    const areas = await db.query.areas.findMany({
      with: this.relations,
      limit: pageSize,
      offset: page * pageSize,
    })
    return areas.map(unwrapJunctions)
  }

  async getById(id: string): Promise<HydratedArea | null> {
    const db = await this.getDb()
    if (!db) return null

    const area = await db.query.areas.findFirst({
      where: (areas, { eq }) => eq(areas.id, id),
      with: this.relations,
    })
    return area ? unwrapJunctions(area) : null
  }

  async search(query: string, limit: number): Promise<HydratedArea[]> {
    const db = await this.getDb()
    if (!db) return []

    const pattern = `%${query}%`
    const areas = await db.query.areas.findMany({
      where: (areas, { like, or, inArray }) =>
        or(
          like(areas.title, pattern),
          inArray(areas.id, taggedIds(db, pattern)),
        ),
      limit,
      with: this.relations,
    })
    return areas.map(unwrapJunctions)
  }
}
