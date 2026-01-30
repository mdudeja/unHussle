import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
} from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { entityCollectionSchema } from './common.schema'
import { goalsSchema } from './goals.schema'
import { areasSchema } from './areas.schema'
import { EntityCollection, InferTableTypes } from '@c/index'
import { tasksSchema } from './tasks.schema'
import { resourcesSchema } from './resources.schema'
import { junctionTagsSchema } from './junction.tags.schema'
import { junctionUrlsSchema } from './junction.urls.schema'

export const projectsSchema = sqliteTable(
  'projects',
  {
    ...entityCollectionSchema,
    area_id: text().references(() => areasSchema.id),
    goal_id: text().references(() => goalsSchema.id),
    due_date: integer({ mode: 'timestamp_ms' }),
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

export const projectsRelations = relations(projectsSchema, ({ one, many }) => ({
  area: one(areasSchema, {
    fields: [projectsSchema.area_id],
    references: [areasSchema.id],
  }),
  goal: one(goalsSchema, {
    fields: [projectsSchema.goal_id],
    references: [goalsSchema.id],
  }),
  tasks: many(tasksSchema),
  resources: many(resourcesSchema),
  tags: many(junctionTagsSchema),
  urls: many(junctionUrlsSchema),
}))

export type Project = InferTableTypes<EntityCollection, typeof projectsSchema>
