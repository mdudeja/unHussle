import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core'
import { entitySupporterSchema } from './common.schema'
import { EntitySupporter, InferTableTypes } from '@c/index'
import { tasksSchema } from '.'

export const timeEntriesSchema = sqliteTable(
  'time_entries',
  {
    ...entitySupporterSchema,
    task_id: text('task_id').references(() => tasksSchema.id, {
      onDelete: 'cascade',
    }),
    start_time: integer({ mode: 'timestamp_ms' }).notNull(),
    end_time: integer({ mode: 'timestamp_ms' }),
    duration: integer().default(0),
  },
  (table) => [index('time_entries_task_idx').on(table.task_id)],
)

export type TimeEntry = InferTableTypes<
  EntitySupporter,
  typeof timeEntriesSchema
>
