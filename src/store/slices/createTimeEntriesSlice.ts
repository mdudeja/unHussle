import { TimeEntriesService } from '@/services/TimeEntriesService'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'
import { TimeEntry } from '@d/database/schemas/time_entries.schema'

export interface TimeEntriesSlice {
  time_entries: DbSlice<TimeEntry>
}

export const createTimeEntriesSlice = generateCreateDbConnectedStateSlice<
  TimeEntry,
  'time_entries'
>(TimeEntriesService.getInstance(), 'time_entries')
