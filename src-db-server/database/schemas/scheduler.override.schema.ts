import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import type { InferTableTypes } from '@c/types'
import { tasks } from './tasks.schema'

export const schedulingOverrides = sqliteTable(
  'scheduling_overrides',
  {
    id: text()
      .primaryKey()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    availableDate: text('available_date').notNull(),
  },
  (table) => [index('scheduling_overrides_date_idx').on(table.availableDate)],
)

export const schedulingOverridesRelations = relations(
  schedulingOverrides,
  ({ one }) => ({
    task: one(tasks, {
      fields: [schedulingOverrides.id],
      references: [tasks.id],
    }),
  }),
)

export type SchedulingOverride = InferTableTypes<
  typeof schedulingOverrides.$inferSelect,
  typeof schedulingOverrides
>
