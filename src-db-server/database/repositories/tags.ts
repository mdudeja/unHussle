import { Tag, tags } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { BaseRepository } from './BaseRepository'

export class TagsRepository
  extends BaseRepository<typeof tags>
  implements IRepository<Tag>
{
  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, tags)
  }

  async getAll(): Promise<Tag['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.tags.findMany()
  }

  async getPaginated(page: number, pageSize: number): Promise<Tag['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.tags.findMany({
      limit: pageSize,
      offset: page * pageSize,
    })
  }

  async getById(id: string): Promise<Tag['Read'] | null> {
    const db = await this.getDb()
    if (!db) return null

    const tag = await db.query.tags.findFirst({
      where: (tags, { eq }) => eq(tags.id, id),
    })
    return tag ?? null
  }

  async search(query: string, limit: number): Promise<Tag['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.tags.findMany({
      where: (tags, { like }) => like(tags.title, `%${query}%`),
      limit,
    })
  }
}
