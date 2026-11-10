import { withCollectionTotals } from './taskMembership'
import { Project, projects } from '../schemas'
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

import type { HydratedProject } from '@c/types/Hydrated'
export type { HydratedProject } from '@c/types/Hydrated'

export class ProjectsRepository
  extends BaseRepository<typeof projects>
  implements IRepository<Project>
{
  private readonly relations = {
    area: { columns: referenceColumns },
    goal: { columns: referenceColumns },
    resources: withResources,
    tags: withTags,
    urls: withUrls,
  } as const

  private readonly listRelations = {
    tags: withTags,
    area: { columns: referenceColumns },
    goal: { columns: referenceColumns },
  } as const

  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, projects)
  }

  async getAll(): Promise<HydratedProject[]> {
    const db = await this.getDb()
    if (!db) return []

    const projects = await db.query.projects.findMany({
      with: this.listRelations,
    })
    return withCollectionTotals(db, 'projects', projects.map(unwrapJunctions))
  }

  async getPaginated(
    page: number,
    pageSize: number,
  ): Promise<HydratedProject[]> {
    const db = await this.getDb()
    if (!db) return []

    const projects = await db.query.projects.findMany({
      with: this.listRelations,
      limit: pageSize,
      offset: page * pageSize,
    })
    return withCollectionTotals(db, 'projects', projects.map(unwrapJunctions))
  }

  async getById(id: string): Promise<HydratedProject | null> {
    const db = await this.getDb()
    if (!db) return null

    const project = await db.query.projects.findFirst({
      where: (projects, { eq }) => eq(projects.id, id),
      with: this.relations,
    })
    if (!project) return null
    return withCollectionTotals(db, 'projects', [unwrapJunctions(project)])[0]
  }

  async search(query: string, limit: number): Promise<HydratedProject[]> {
    const db = await this.getDb()
    if (!db) return []

    const pattern = `%${query}%`
    const projects = await db.query.projects.findMany({
      where: (projects, { like, or, inArray }) =>
        or(
          like(projects.title, pattern),
          inArray(projects.id, taggedIds(db, pattern)),
        ),
      limit,
      with: this.listRelations,
    })
    return withCollectionTotals(db, 'projects', projects.map(unwrapJunctions))
  }

  async getByIds(ids: string[]): Promise<HydratedProject[]> {
    const db = await this.getDb()
    if (!db || ids.length === 0) return []

    const projects = await db.query.projects.findMany({
      where: (projects, { inArray }) => inArray(projects.id, ids),
      with: this.listRelations,
    })
    return withCollectionTotals(db, 'projects', projects.map(unwrapJunctions))
  }
}
