import { TimeEntry, timeEntries } from '../schemas'
import { UnHussleDB } from '../UnHussleDB'
import { IRepository } from './IRepository.interface'
import { BaseRepository } from './BaseRepository'

export class TimeEntriesRepository
  extends BaseRepository<typeof timeEntries>
  implements IRepository<TimeEntry>
{
  constructor(dbInstance: UnHussleDB) {
    super(dbInstance, timeEntries)
  }

  async getAll(): Promise<TimeEntry['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.timeEntries.findMany()
  }

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

  async getById(id: string): Promise<TimeEntry['Read'] | null> {
    const db = await this.getDb()
    if (!db) return null

    const timeEntry = await db.query.timeEntries.findFirst({
      where: (timeEntries, { eq }) => eq(timeEntries.id, id),
    })
    return timeEntry ?? null
  }

  async search(query: string, limit: number): Promise<TimeEntry['Read'][]> {
    const db = await this.getDb()
    if (!db) return []

    return db.query.timeEntries.findMany({
      where: (timeEntries, { like }) => like(timeEntries.title, `%${query}%`),
      limit,
    })
  }
}
