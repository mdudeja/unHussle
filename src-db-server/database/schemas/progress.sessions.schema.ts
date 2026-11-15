import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { relations, sql } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'
import { getNowMillis } from '@c/datetimeUtils'
import type { InferTableTypes } from '@c/types'
import { projects } from './projects.schema'
import { goals } from './goals.schema'
import { tasks } from './tasks.schema'
import { taskOccurrences } from './scheduler.occurrences.schema'

/** One completed task or occurrence that fed a counting project or goal. */
export const progressSessions = sqliteTable(
  'progress_sessions',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => createId()),
    project_id: text().references(() => projects.id, { onDelete: 'cascade' }),
    goal_id: text().references(() => goals.id, { onDelete: 'cascade' }),
    task_id: text().references(() => tasks.id, { onDelete: 'set null' }),
    occurrence_id: text().references(() => taskOccurrences.id, {
      onDelete: 'set null',
    }),
    minutes: integer({ mode: 'number' }).notNull().default(0),
    // Units added in this session; empty until the user records them.
    amount: integer({ mode: 'number' }),
    created_at: integer({ mode: 'number' })
      .notNull()
      .$default(() => getNowMillis()),
  },
  (table) => [
    check(
      'progress_sessions_one_item',
      sql`(${table.project_id} IS NULL) <> (${table.goal_id} IS NULL)`,
    ),
    index('progress_sessions_project_idx').on(table.project_id),
    index('progress_sessions_goal_idx').on(table.goal_id),
    index('progress_sessions_task_idx').on(table.task_id),
    index('progress_sessions_created_at_idx').on(table.created_at),
  ],
)

export const progressSessionsRelations = relations(
  progressSessions,
  ({ one }) => ({
    project: one(projects, {
      fields: [progressSessions.project_id],
      references: [projects.id],
    }),
    goal: one(goals, {
      fields: [progressSessions.goal_id],
      references: [goals.id],
    }),
  }),
)

export type ProgressSession = InferTableTypes<
  typeof progressSessions.$inferSelect,
  typeof progressSessions
>
