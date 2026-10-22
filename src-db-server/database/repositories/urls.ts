import { Url, urls } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { BaseRepository } from './BaseRepository'

export class UrlsRepository
  extends BaseRepository<typeof urls>
  implements IRepository<Url>
{
  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, urls)
  }

  async getAll(): Promise<Url['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.urls.findMany()
  }

  async getPaginated(page: number, pageSize: number): Promise<Url['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.urls.findMany({
      limit: pageSize,
      offset: page * pageSize,
    })
  }

  async getById(id: string): Promise<Url['Read'] | null> {
    const db = await this.getDb()
    if (!db) return null

    const url = await db.query.urls.findFirst({
      where: (urls, { eq }) => eq(urls.id, id),
    })
    return url ?? null
  }

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
