import { BaseRepository } from '@/services/database/repositories/BaseRepository'
import { TimeEntry } from '@/types'

export class TimeEntriesRepository extends BaseRepository<TimeEntry> {
  protected tableName = 'time_entries'
}
