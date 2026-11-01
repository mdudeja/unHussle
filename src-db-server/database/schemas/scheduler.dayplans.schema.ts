import { integer, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import type { InferTableTypes } from '@c/types'
import { planItems } from './scheduler.planItems.schema'

export const dayPlans = sqliteTable(
  'day_plans',
  {
    id: text().primaryKey(),
    date: text().notNull(),
    timezone: text().notNull(),
    revision: integer().notNull().default(1),
    stale: integer({ mode: 'boolean' }).notNull().default(false),
    conflicts: text({ mode: 'json' }).$type<string[]>().notNull(),
  },
  (table) => [
    index('day_plans_date_idx').on(table.date),
    index('day_plans_timezone_date_idx').on(table.timezone, table.date),
  ],
)

export const dayPlansRelations = relations(dayPlans, ({ many }) => ({
  entries: many(planItems),
}))

export type SchedulerDayPlan = InferTableTypes<
  typeof dayPlans.$inferSelect,
  typeof dayPlans
>
