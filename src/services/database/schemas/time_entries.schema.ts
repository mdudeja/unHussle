import { sqliteTable, integer } from 'drizzle-orm/sqlite-core'
import { entitySupporterSchema } from './common.schema'
import { EntitySupporter, InferTableTypes } from '@/types'

export const timeEntriesSchema = sqliteTable('time_entries', {
  ...entitySupporterSchema,
  start_time: integer({ mode: 'timestamp_ms' }).notNull(),
  end_time: integer({ mode: 'timestamp_ms' }),
  duration: integer().notNull(),
})

export type TimeEntry = InferTableTypes<
  EntitySupporter,
  typeof timeEntriesSchema
>
