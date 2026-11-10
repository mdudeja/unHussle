import { Tag, tags } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { BaseRepository } from './BaseRepository'

/** Provides data access and management for tags, including retrieval, pagination, lookup by identifier, and search. */
export class TagsRepository
  extends BaseRepository<typeof tags>
  implements IRepository<Tag>
{
  /** Initializes the tags repository for accessing and managing tag data. */
  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, tags)
  }

  /** Retrieves all tags from the database. */
  async getAll(): Promise<Tag['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.tags.findMany()
  }

  /** Retrieves a paginated subset of tags. */
  async getPaginated(page: number, pageSize: number): Promise<Tag['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.tags.findMany({
      limit: pageSize,
      offset: page * pageSize,
    })
  }

  /** Retrieves the tag matching the given identifier, or null if no such tag exists. */
  async getById(id: string): Promise<Tag['Read'] | null> {
    const db = await this.getDb()
    if (!db) return null

    const tag = await db.query.tags.findFirst({
      where: (tags, { eq }) => eq(tags.id, id),
    })
    return tag ?? null
  }

  /** Searches for tags whose titles contain the given query. */
  async search(query: string, limit: number): Promise<Tag['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.tags.findMany({
      where: (tags, { like }) => like(tags.title, `%${query}%`),
      limit,
    })
  }
}
