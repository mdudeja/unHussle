import { sqliteTable, integer, text, index } from 'drizzle-orm/sqlite-core'
import { entitySupporterSchema } from './common.schema'
import type { EntitySupporter, InferTableTypes } from '@c/types/index'
import { tasks } from './tasks.schema'
import { relations } from 'drizzle-orm'
import { taskOccurrences } from './scheduler.occurrences.schema'

export const timeEntries = sqliteTable(
  'time_entries',
  {
    ...entitySupporterSchema,
    title: text().default(''),
    occurrence_id: text('occurrence_id').references(() => taskOccurrences.id, {
      onDelete: 'set null',
    }),
    task_id: text('task_id')
      .references(() => tasks.id, {
        onDelete: 'cascade',
      })
      .notNull(),
    start_time: integer({ mode: 'number' }).notNull(),
    end_time: integer({ mode: 'number' }),
    duration: integer().default(0),
  },
  (table) => [
    index('time_entries_task_idx').on(table.task_id),
    index('time_entries_end_start_idx').on(table.end_time, table.start_time),
    index('time_entries_occurrence_idx').on(table.occurrence_id),
  ],
)

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  occurrence: one(taskOccurrences, {
    fields: [timeEntries.occurrence_id],
    references: [taskOccurrences.id],
  }),
}))

export type TimeEntry = InferTableTypes<EntitySupporter, typeof timeEntries>
