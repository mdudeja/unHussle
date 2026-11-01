import { integer, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import type { InferTableTypes } from '@c/types'
import type { WrapReason } from '@c/scheduler/contracts'
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
    /** Set while the user is on a break. */
    breakStartedAt: integer('break_started_at'),
    /** Set while the day is wrapping up. */
    wrapReason: text('wrap_reason').$type<WrapReason>(),
    /** Cleared when the user pulls more work after wrap-up began. */
    autoWrap: integer('auto_wrap', { mode: 'boolean' }).notNull().default(true),
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
