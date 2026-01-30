import { TimeEntry } from '@c/index'
import { DbService } from '@/services/DbService'

export class TimeEntriesService extends DbService<TimeEntry> {
  private static instance: TimeEntriesService

  constructor() {
    super('time_entries')
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new TimeEntriesService()
    }
    return this.instance
  }
}
