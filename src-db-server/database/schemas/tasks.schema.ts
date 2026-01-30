import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import {
  entitySchema,
  junctionTimeEntriesSchema,
  prioritySchema,
  statusSchema,
} from '@d/database/schemas/index'
import { Entity, InferTableTypes } from '@c/index'
import {
  projectsSchema,
  areasSchema,
  goalsSchema,
  junctionTagsSchema,
  junctionUrlsSchema,
} from '@d/database/schemas/index'

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
  ],
)

export const tasksRelations = relations(tasksSchema, ({ one, many }) => ({
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
  tags: many(junctionTagsSchema),
  urls: many(junctionUrlsSchema),
  timeEntries: many(junctionTimeEntriesSchema),
}))

export type Task = InferTableTypes<Entity, typeof tasksSchema>
