import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { entitySchema, prioritySchema, statusSchema } from './common.schema'
import { Entity, InferTableTypes } from '@c/index'
import { projectsSchema } from './projects.schema'
import { areasSchema } from './areas.schema'
import { goalsSchema } from './goals.schema'

export const tasksSchema = sqliteTable(
  'tasks',
  {
    ...entitySchema,
    // Override to add references
    project_id: text('project_id').references(() => projectsSchema.id, {
      onDelete: 'set null',
    }),
    area_id: text('area_id').references(() => areasSchema.id, {
      onDelete: 'set null',
    }),
    goal_id: text('goal_id').references(() => goalsSchema.id, {
      onDelete: 'set null',
    }),
    ...statusSchema,
    ...prioritySchema,
    estimated_minutes: integer({ mode: 'number' }),
    spent_minutes: integer({ mode: 'number' }).notNull().default(0),
    due_date: integer({ mode: 'timestamp_ms' }),
    is_recurring: integer({ mode: 'boolean' }).notNull().default(false),
    recurring_rule: text(),
    is_fun: integer({ mode: 'boolean' }).notNull().default(false),
    is_chore: integer({ mode: 'boolean' }).notNull().default(false),
    stack_order: integer({ mode: 'number' }).notNull().default(0),
    scheduled_for: integer({ mode: 'timestamp_ms' }),
    completed_at: integer({ mode: 'timestamp_ms' }),
    time_entry_ids: text({ mode: 'json' })
      .$type<string[]>()
      .$default(() => []),
  },
  (table) => [
    index('tasks_project_idx').on(table.project_id),
    index('tasks_area_idx').on(table.area_id),
    index('tasks_goal_idx').on(table.goal_id),
    index('tasks_status_idx').on(table.status),
    index('tasks_due_date_idx').on(table.due_date),
    index('tasks_scheduled_for_idx').on(table.scheduled_for),
  ],
)

export const tasksRelations = relations(tasksSchema, ({ one }) => ({
  project: one(projectsSchema, {
    fields: [tasksSchema.project_id],
    references: [projectsSchema.id],
  }),
  area: one(areasSchema, {
    fields: [tasksSchema.area_id],
    references: [areasSchema.id],
  }),
  goal: one(goalsSchema, {
    fields: [tasksSchema.goal_id],
    references: [goalsSchema.id],
  }),
}))

export type Task = InferTableTypes<Entity, typeof tasksSchema>
