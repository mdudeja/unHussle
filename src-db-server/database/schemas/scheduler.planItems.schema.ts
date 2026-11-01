import {
  integer,
  index,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import type { InferTableTypes } from '@c/types'
import { dayPlans } from './scheduler.dayplans.schema'
import { tasks } from './tasks.schema'
import { taskOccurrences } from './scheduler.occurrences.schema'

export const planItems = sqliteTable(
  'plan_items',
  {
    id: text().primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => dayPlans.id, { onDelete: 'cascade' }),
    itemId: text('item_id').notNull(),
    sourceTaskId: text('source_task_id').notNull(),
    taskId: text('task_id').references(() => tasks.id, {
      onDelete: 'set null',
    }),
    occurrenceId: text('occurrence_id').references(() => taskOccurrences.id, {
      onDelete: 'set null',
    }),
    position: integer().notNull(),
    status: text().notNull(),
    pinned: integer({ mode: 'boolean' }).notNull().default(false),
    reason: text(),
  },
  (table) => [
    uniqueIndex('plan_items_plan_item_idx').on(table.planId, table.itemId),
    index('plan_items_plan_position_idx').on(table.planId, table.position),
    index('plan_items_source_status_idx').on(
      table.sourceTaskId,
      table.status,
      table.planId,
    ),
    index('plan_items_task_idx').on(table.taskId),
    index('plan_items_occurrence_idx').on(table.occurrenceId),
  ],
)

export const planItemsRelations = relations(planItems, ({ one }) => ({
  plan: one(dayPlans, {
    fields: [planItems.planId],
    references: [dayPlans.id],
  }),
  task: one(tasks, { fields: [planItems.taskId], references: [tasks.id] }),
  occurrence: one(taskOccurrences, {
    fields: [planItems.occurrenceId],
    references: [taskOccurrences.id],
  }),
}))

export type SchedulerPlanItem = InferTableTypes<
  typeof planItems.$inferSelect,
  typeof planItems
>
