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
>('time_entries')
