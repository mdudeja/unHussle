import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import {
  entitySchema,
  junctionTimeEntries,
  prioritySchema,
  statusSchema,
} from '@d/database/schemas/index'
import { Entity, InferTableTypes } from '@c/index'
import {
  projects,
  areas,
  goals,
  junctionTags,
  junctionUrls,
} from '@d/database/schemas/index'

export const tasks = sqliteTable(
  'tasks',
  {
    ...entitySchema,
    // Override to add references
    project_id: text('project_id').references(() => projects.id, {
      onDelete: 'set null',
    }),
    area_id: text('area_id').references(() => areas.id, {
      onDelete: 'set null',
    }),
    goal_id: text('goal_id').references(() => goals.id, {
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
    is_quick: integer({ mode: 'boolean' }).notNull().default(false),
    stack_order: integer({ mode: 'number' }).notNull().default(0),
    scheduled_for: integer({ mode: 'timestamp_ms' }),
    started_at: integer({ mode: 'timestamp_ms' }),
    completed_at: integer({ mode: 'timestamp_ms' }),
  },
  (table) => [
    index('tasks_project_idx').on(table.project_id),
    index('tasks_area_idx').on(table.area_id),
    index('tasks_goal_idx').on(table.goal_id),
    index('tasks_status_idx').on(table.status),
    index('tasks_due_date_idx').on(table.due_date),
    index('tasks_scheduled_for_idx').on(table.scheduled_for),
    index('tasks_title_idx').on(table.title),
    index('tasks_created_at_idx').on(table.created_at),
    index('tasks_updated_at_idx').on(table.updated_at),
  ],
)

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.project_id],
    references: [projects.id],
  }),
  area: one(areas, {
    fields: [tasks.area_id],
    references: [areas.id],
  }),
  goal: one(goals, {
    fields: [tasks.goal_id],
    references: [goals.id],
  }),
  tags: many(junctionTags),
  urls: many(junctionUrls),
  timeEntries: many(junctionTimeEntries),
}))

export type Task = InferTableTypes<Entity, typeof tasks>
