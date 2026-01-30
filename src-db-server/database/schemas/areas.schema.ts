import { index, sqliteTable, unique } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { entityCollectionSchema } from './common.schema'
import { EntityCollection, InferTableTypes } from '@c/index'
import { tasksSchema } from './tasks.schema'
import { resourcesSchema } from './resources.schema'
import { projectsSchema } from './projects.schema'
import { junctionTagsSchema } from './junction.tags.schema'
import { junctionUrlsSchema } from './junction.urls.schema'

export const areasSchema = sqliteTable(
  'areas',
  {
    ...entityCollectionSchema,
  },
  (table) => [
    index('areas_title_idx').on(table.title),
    index('areas_status_idx').on(table.status),
    index('areas_priority_idx').on(table.priority),
    unique('areas_title_unique').on(table.title),
  ],
)

export const areasRelations = relations(areasSchema, ({ many }) => ({
  tasks: many(tasksSchema),
  resources: many(resourcesSchema),
  projects: many(projectsSchema),
  tags: many(junctionTagsSchema),
  urls: many(junctionUrlsSchema),
}))

export type Area = InferTableTypes<EntityCollection, typeof areasSchema>
