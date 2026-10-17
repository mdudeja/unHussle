import { index, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { entityCollectionSchema } from './common.schema'
import { EntityCollection, InferTableTypes } from '@c/types/index'
import { tasks } from './tasks.schema'
import { resources } from './resources.schema'
import { projects } from './projects.schema'
import { junctionTags } from './junction.tags.schema'
import { junctionUrls } from './junction.urls.schema'

export const areas = sqliteTable(
  'areas',
  {
    ...entityCollectionSchema,
    area_tag: text(),
  },
  (table) => [
    index('areas_title_idx').on(table.title),
    index('areas_status_idx').on(table.status),
    index('areas_priority_idx').on(table.priority),
    index('areas_created_at_idx').on(table.created_at),
    index('areas_updated_at_idx').on(table.updated_at),
    unique('areas_title_unique').on(table.title),
    unique('areas_area_tag_unique').on(table.area_tag),
  ],
)

export const areasRelations = relations(areas, ({ many }) => ({
  tasks: many(tasks),
  resources: many(resources),
  projects: many(projects),
  tags: many(junctionTags),
  urls: many(junctionUrls),
}))

export type Area = InferTableTypes<EntityCollection, typeof areas>
