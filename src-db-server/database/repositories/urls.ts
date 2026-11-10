import { Url, urls } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { BaseRepository } from './BaseRepository'

/** Repository for managing and retrieving stored URL records. */
export class UrlsRepository
  extends BaseRepository<typeof urls>
  implements IRepository<Url>
{
  /** Initializes a repository for managing URL records using the provided database instance. */
  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, urls)
  }

  /** Retrieves all URL records. */
  async getAll(): Promise<Url['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.urls.findMany()
  }

  /** Retrieves a page of URL records to support paginated access. */
  async getPaginated(page: number, pageSize: number): Promise<Url['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.urls.findMany({
      limit: pageSize,
      offset: page * pageSize,
    })
  }

  /** Retrieves the stored URL associated with the given identifier, if one exists. */
  async getById(id: string): Promise<Url['Read'] | null> {
    const db = await this.getDb()
    if (!db) return null

    const url = await db.query.urls.findFirst({
      where: (urls, { eq }) => eq(urls.id, id),
    })
    return url ?? null
  }

  /** Search for stored URLs that match the given query. */
  async search(query: string, limit: number): Promise<Url['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    const pattern = `%${query}%`
    return db.query.urls.findMany({
      where: (urls, { like, or }) =>
        or(like(urls.title, pattern), like(urls.url, pattern)),
      limit,
    })
  }
}
