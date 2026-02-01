import { sqliteTable, text, index, unique } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { entitySchema } from './common.schema'
import { Entity, InferTableTypes } from '@c/index'
import { projects } from './projects.schema'
import { areas } from './areas.schema'
import { goals } from './goals.schema'
import { junctionTags } from './junction.tags.schema'
import { junctionUrls } from './junction.urls.schema'

export const resources = sqliteTable(
  'resources',
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
  },
  (table) => [
    index('resources_project_idx').on(table.project_id),
    index('resources_area_idx').on(table.area_id),
    index('resources_goal_idx').on(table.goal_id),
    index('resources_title_idx').on(table.title),
    index('resources_created_at_idx').on(table.created_at),
    index('resources_updated_at_idx').on(table.updated_at),
    unique('resources_title_unique').on(table.title),
  ],
)

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  project: one(projects, {
    fields: [resources.project_id],
    references: [projects.id],
  }),
  area: one(areas, {
    fields: [resources.area_id],
    references: [areas.id],
  }),
  goal: one(goals, {
    fields: [resources.goal_id],
    references: [goals.id],
  }),
  tags: many(junctionTags),
  urls: many(junctionUrls),
}))

export type Resource = InferTableTypes<Entity, typeof resources>
