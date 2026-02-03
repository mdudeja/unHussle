import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core'
import { entitySupporterSchema } from './common.schema'
import { EntitySupporter, InferTableTypes } from '@c/types/index'
import { tasks } from '.'

export const timeEntries = sqliteTable(
  'time_entries',
  {
    ...entitySupporterSchema,
    title: text().default(''),
    task_id: text('task_id').references(() => tasks.id, {
      onDelete: 'cascade',
    }),
    start_time: integer({ mode: 'number' }).notNull(),
    end_time: integer({ mode: 'number' }),
    duration: integer().default(0),
  },
  (table) => [index('time_entries_task_idx').on(table.task_id)],
)

export type TimeEntry = InferTableTypes<EntitySupporter, typeof timeEntries>
