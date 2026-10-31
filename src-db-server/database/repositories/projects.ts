import { Project, projects } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { BaseRepository } from './BaseRepository'
import {
  mergeCollectionMembers,
  taggedIds,
  unwrapJunctions,
  withMembers,
  withTags,
  withUrls,
} from './helpers'

import type { HydratedProject } from '@c/types/Hydrated'
export type { HydratedProject } from '@c/types/Hydrated'

export class ProjectsRepository
  extends BaseRepository<typeof projects>
  implements IRepository<Project>
{
  private readonly relations = {
    area: true,
    goal: true,
    tasks: true,
    resources: true,
    tags: withTags,
    urls: withUrls,
  } as const

  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, projects)
  }

  async getAll(): Promise<HydratedProject[]> {
    const db = await this.getDb()
    if (!db) return []

    const projects = await db.query.projects.findMany({
      with: this.relations,
    })
    return projects.map(unwrapJunctions)
  }

  async getPaginated(
    page: number,
    pageSize: number,
  ): Promise<HydratedProject[]> {
    const db = await this.getDb()
    if (!db) return []

    const projects = await db.query.projects.findMany({
      with: this.relations,
      limit: pageSize,
      offset: page * pageSize,
    })
    return projects.map(unwrapJunctions)
  }

  async getById(id: string): Promise<HydratedProject | null> {
    const db = await this.getDb()
    if (!db) return null

    const project = await db.query.projects.findFirst({
      where: (projects, { eq }) => eq(projects.id, id),
      with: {
        ...this.relations,
        area: withMembers,
        goal: withMembers,
      },
    })
    if (!project) return null

    return mergeCollectionMembers(unwrapJunctions(project), ['area', 'goal'])
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
      with: this.relations,
    })
    return projects.map(unwrapJunctions)
  }

  async getByIds(ids: string[]): Promise<HydratedProject[]> {
    const db = await this.getDb()
    if (!db || ids.length === 0) return []

    const projects = await db.query.projects.findMany({
      where: (projects, { inArray }) => inArray(projects.id, ids),
      with: this.relations,
    })
    return projects.map(unwrapJunctions)
  }
}
