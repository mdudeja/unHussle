import { TimeEntry, timeEntries } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { BaseRepository } from './BaseRepository'

/** Repository for managing and accessing time entry data, including retrieval and search operations. */
export class TimeEntriesRepository
  extends BaseRepository<typeof timeEntries>
  implements IRepository<TimeEntry>
{
  /** Initializes a repository for managing time entry data. */
  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, timeEntries)
  }

  /** Retrieves all time entries. */
  async getAll(): Promise<TimeEntry['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.timeEntries.findMany()
  }

  /** Retrieves a paginated subset of time entries from the database. */
  async getPaginated(
    page: number,
    pageSize: number,
  ): Promise<TimeEntry['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.timeEntries.findMany({
      limit: pageSize,
      offset: page * pageSize,
    })
  }

  /** Retrieves the time entry with the specified identifier. */
  async getById(id: string): Promise<TimeEntry['Read'] | null> {
    const db = await this.getDb()
    if (!db) return null

    const timeEntry = await db.query.timeEntries.findFirst({
      where: (timeEntries, { eq }) => eq(timeEntries.id, id),
    })
    return timeEntry ?? null
  }

  /** Searches time entries by title and returns those matching the query. */
  async search(query: string, limit: number): Promise<TimeEntry['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.timeEntries.findMany({
      where: (timeEntries, { like }) => like(timeEntries.title, `%${query}%`),
      limit,
    })
  }
}
