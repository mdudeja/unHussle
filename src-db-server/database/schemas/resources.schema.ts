import { sqliteTable, text, index, unique } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { entitySchema } from './common.schema'
import { Entity, InferTableTypes } from '@c/index'
import { projectsSchema } from './projects.schema'
import { areasSchema } from './areas.schema'
import { goalsSchema } from './goals.schema'
import { junctionTagsSchema } from './junction.tags.schema'
import { junctionUrlsSchema } from './junction.urls.schema'

export const resourcesSchema = sqliteTable(
  'resources',
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
  },
  (table) => [
    index('resources_project_idx').on(table.project_id),
    index('resources_area_idx').on(table.area_id),
    index('resources_goal_idx').on(table.goal_id),
    index('resources_title_idx').on(table.title),
    unique('resources_title_unique').on(table.title),
  ],
)

export const resourcesRelations = relations(
  resourcesSchema,
  ({ one, many }) => ({
    project: one(projectsSchema, {
      fields: [resourcesSchema.project_id],
      references: [projectsSchema.id],
    }),
    area: one(areasSchema, {
      fields: [resourcesSchema.area_id],
      references: [areasSchema.id],
    }),
    goal: one(goalsSchema, {
      fields: [resourcesSchema.goal_id],
      references: [goalsSchema.id],
    }),
    tags: many(junctionTagsSchema),
    urls: many(junctionUrlsSchema),
  }),
)

export type Resource = InferTableTypes<Entity, typeof resourcesSchema>
