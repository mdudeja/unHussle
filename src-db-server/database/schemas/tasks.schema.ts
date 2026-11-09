import {
  integer,
  sqliteTable,
  text,
  index,
  AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import {
  entitySchema,
  junctionTimeEntries,
  prioritySchema,
  statusSchema,
  projects,
  areas,
  goals,
  junctionTags,
  junctionUrls,
  junctionResources,
  RecurranceRule,
  anchorTypeSchema,
  taskOccurrences,
  planItems,
  schedulingOverrides,
} from '@d/database/schemas/index'
import type { Entity, InferTableTypes } from '@c/types/index'

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
    anchor_id: text('anchor_id').references((): AnySQLiteColumn => tasks.id, {
      onDelete: 'set null',
    }),
    ...anchorTypeSchema,
    anchor_slot: integer({ mode: 'number' }),
    estimated_minutes: integer({ mode: 'number' }),
    spent_minutes: integer({ mode: 'number' }).notNull().default(0),
    due_date: integer({ mode: 'number' }),
    is_recurring: integer({ mode: 'boolean' }).notNull().default(false),
    recurrance_rule: text({ mode: 'json' }).$type<RecurranceRule>(),
    is_fun: integer({ mode: 'boolean' }).notNull().default(false),
    is_chore: integer({ mode: 'boolean' }).notNull().default(false),
    is_quick: integer({ mode: 'boolean' }).notNull().default(false),
    stack_order: integer({ mode: 'number' }).notNull().default(0),
    scheduled_start: integer({ mode: 'number' }),
    scheduled_end: integer({ mode: 'number' }),
    started_at: integer({ mode: 'number' }),
    completed_at: integer({ mode: 'number' }),
  },
  (table) => [
    index('tasks_project_idx').on(table.project_id),
    index('tasks_area_idx').on(table.area_id),
    index('tasks_goal_idx').on(table.goal_id),
    index('tasks_status_idx').on(table.status),
    index('tasks_anchor_idx').on(table.anchor_id),
    index('tasks_due_date_idx').on(table.due_date),
    index('tasks_scheduled_start_idx').on(table.scheduled_start),
    index('tasks_scheduled_end_idx').on(table.scheduled_end),
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
  anchor: one(tasks, {
    fields: [tasks.anchor_id],
    references: [tasks.id],
  }),
  occurrences: many(taskOccurrences),
  scheduleItems: many(planItems),
  schedulingOverride: one(schedulingOverrides),
  tags: many(junctionTags),
  urls: many(junctionUrls),
  timeEntries: many(junctionTimeEntries),
  resources: many(junctionResources),
}))

export type Task = InferTableTypes<Entity, typeof tasks>
