import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { entityCollectionSchema } from './common.schema'
import { goals } from './goals.schema'
import { areas } from './areas.schema'
import { EntityCollection, InferTableTypes } from '@c/types/index'
import { tasks } from './tasks.schema'
import { resources } from './resources.schema'
import { junctionTags } from './junction.tags.schema'
import { junctionUrls } from './junction.urls.schema'

export const projects = sqliteTable(
  'projects',
  {
    ...entityCollectionSchema,
    area_id: text().references(() => areas.id),
    goal_id: text().references(() => goals.id),
    due_date: integer({ mode: 'number' }),
  },
  (table) => [
    index('projects_title_idx').on(table.title),
    index('projects_area_idx').on(table.area_id),
    index('projects_goal_idx').on(table.goal_id),
    index('projects_due_date_idx').on(table.due_date),
    index('projects_status_idx').on(table.status),
    index('projects_priority_idx').on(table.priority),
    index('projects_created_at_idx').on(table.created_at),
    index('projects_updated_at_idx').on(table.updated_at),
    unique('projects_title_unique').on(table.title),
  ],
)

export const projectsRelations = relations(projects, ({ one, many }) => ({
  area: one(areas, {
    fields: [projects.area_id],
    references: [areas.id],
  }),
  goal: one(goals, {
    fields: [projects.goal_id],
    references: [goals.id],
  }),
  tasks: many(tasks),
  resources: many(resources),
  tags: many(junctionTags),
  urls: many(junctionUrls),
}))

export type Project = InferTableTypes<EntityCollection, typeof projects>
