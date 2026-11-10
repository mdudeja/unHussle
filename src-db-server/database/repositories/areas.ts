import { withCollectionTotals } from './taskMembership'
import { Area, areas } from '../schemas'
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

import type { HydratedArea } from '@c/types/Hydrated'
export type { HydratedArea } from '@c/types/Hydrated'

/** Provides repository access to area records and their related data. */
export class AreasRepository
  extends BaseRepository<typeof areas>
  implements IRepository<Area>
{
  private readonly relations = {
    goals: true,
    resources: withResources,
    projects: true,
    tags: withTags,
    urls: withUrls,
  } as const

  private readonly listRelations = { tags: withTags } as const

  /** Creates an areas repository backed by the application database. */
  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, areas)
  }

  /** Retrieves all areas with their related data and collection totals. */
  async getAll(): Promise<HydratedArea[]> {
    const db = await this.getDb()
    if (!db) return []

    const areas = await db.query.areas.findMany({
      with: this.listRelations,
    })
    return withCollectionTotals(db, 'areas', areas.map(unwrapJunctions))
  }

  /** Retrieves a page of areas with their related data and collection totals. */
  async getPaginated(page: number, pageSize: number): Promise<HydratedArea[]> {
    const db = await this.getDb()
    if (!db) return []

    const areas = await db.query.areas.findMany({
      with: this.listRelations,
      limit: pageSize,
      offset: page * pageSize,
    })
    return withCollectionTotals(db, 'areas', areas.map(unwrapJunctions))
  }

  /** Retrieves a fully hydrated area, including its related data and collection totals, for the given identifier. */
  async getById(id: string): Promise<HydratedArea | null> {
    const db = await this.getDb()
    if (!db) return null

    const area = await db.query.areas.findFirst({
      where: (areas, { eq }) => eq(areas.id, id),
      with: this.relations,
    })
    if (!area) return null
    return withCollectionTotals(db, 'areas', [unwrapJunctions(area)])[0]
  }

  /** Finds areas matching a search query by title or tag and returns them with their collection totals. */
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
      with: this.listRelations,
    })
    return withCollectionTotals(db, 'areas', areas.map(unwrapJunctions))
  }

  /** Retrieves the areas corresponding to the specified IDs. */
  async getByIds(ids: string[]): Promise<HydratedArea[]> {
    const db = await this.getDb()
    if (!db || ids.length === 0) return []

    const areas = await db.query.areas.findMany({
      where: (areas, { inArray }) => inArray(areas.id, ids),
      with: this.listRelations,
    })
    return withCollectionTotals(db, 'areas', areas.map(unwrapJunctions))
  }
}
