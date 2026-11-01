import { Resource, resources } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { BaseRepository } from './BaseRepository'
import {
  taggedIds,
  toResourceLinks,
  unwrapJunctions,
  withResourceLinks,
  withTags,
  withUrls,
} from './helpers'

import { fileExists } from '@d/vault/vault'
import type { HydratedResource } from '@c/types/Hydrated'
export type { HydratedResource } from '@c/types/Hydrated'

type ResourceRow = Parameters<typeof unwrapJunctions>[0] & {
  links?: Parameters<typeof toResourceLinks>[0]
}

export class ResourcesRepository
  extends BaseRepository<typeof resources>
  implements IRepository<Resource>
{
  private readonly relations = {
    tags: withTags,
    urls: withUrls,
    links: withResourceLinks,
  } as const

  /**
   * `vaultRoot` gives the vault folder, so rows can say whether their file is
   * `missing`. Without it, `missing` is left out.
   */
  constructor(
    dbInstance: UnHussleDB,
    private readonly vaultRoot?: () => string,
  ) {
    super(dbInstance, resources)
  }

  private hydrateAll = <T extends ResourceRow & { file_path: string | null }>(
    rows: T[],
  ): HydratedResource[] => {
    const root = this.vaultRoot?.()
    return rows.map((row) => {
      const resource = unwrapJunctions(row) as unknown as HydratedResource
      resource.links = toResourceLinks(row.links)
      if (root !== undefined)
        resource.missing = !fileExists(root, row.file_path)
      return resource
    })
  }

  async getAll(): Promise<HydratedResource[]> {
    const db = await this.getDb()
    if (!db) return []

    const resources = await db.query.resources.findMany({
      with: this.relations,
    })
    return this.hydrateAll(resources)
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
    return this.hydrateAll(resources)
  }

  async getById(id: string): Promise<HydratedResource | null> {
    const db = await this.getDb()
    if (!db) return null

    const resource = await db.query.resources.findFirst({
      where: (resources, { eq }) => eq(resources.id, id),
      with: this.relations,
    })
    return resource ? this.hydrateAll([resource])[0] : null
  }

  async getByIds(ids: string[]): Promise<HydratedResource[]> {
    const db = await this.getDb()
    if (!db || ids.length === 0) return []

    const resources = await db.query.resources.findMany({
      where: (resources, { inArray }) => inArray(resources.id, ids),
      with: this.relations,
    })
    return this.hydrateAll(resources)
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
    return this.hydrateAll(resources)
  }
}
