import { TimeEntry } from '@c/types/index'
import { DbService } from '@/services/database/DbService'

/** Provides shared access to time entry data and operations throughout the application. */
export class TimeEntriesService extends DbService<TimeEntry> {
  private static instance: TimeEntriesService

  /** Initializes the time entries service. */
  constructor() {
    super('time_entries')
  }

  /** Provides the shared TimeEntriesService instance so that the same service object is reused throughout the application. */
  static getInstance() {
    if (!this.instance) {
      this.instance = new TimeEntriesService()
    }
    return this.instance
  }
}
