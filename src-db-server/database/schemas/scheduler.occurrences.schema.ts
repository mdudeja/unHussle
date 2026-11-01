import {
  integer,
  index,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import type { InferTableTypes } from '@c/types'
import { tasks } from './tasks.schema'
import { planItems } from './scheduler.planItems.schema'
import { timeEntries } from './time_entries.schema'

export const taskOccurrences = sqliteTable(
  'task_occurrences',
  {
    id: text().primaryKey(),
    sourceTaskId: text('task_id').notNull(),
    taskId: text('task_ref_id').references(() => tasks.id, {
      onDelete: 'set null',
    }),
    date: text().notNull(),
    slot: integer().notNull().default(0),
    status: text().notNull().default('planned'),
    spentMinutes: integer('spent_minutes').notNull().default(0),
  },
  (table) => [
    uniqueIndex('occurrence_task_date_slot').on(
      table.sourceTaskId,
      table.date,
      table.slot,
    ),
    index('occurrence_date_status_idx').on(table.date, table.status),
    index('occurrence_status_date_idx').on(table.status, table.date),
    index('occurrence_task_ref_idx').on(table.taskId),
    index('occurrence_source_status_date_idx').on(
      table.sourceTaskId,
      table.status,
      table.date,
    ),
  ],
)

export const taskOccurrencesRelations = relations(
  taskOccurrences,
  ({ one, many }) => ({
    task: one(tasks, {
      fields: [taskOccurrences.taskId],
      references: [tasks.id],
    }),
    entries: many(planItems),
    timeEntries: many(timeEntries),
  }),
)

export type TaskOccurrence = InferTableTypes<
  typeof taskOccurrences.$inferSelect,
  typeof taskOccurrences
>
