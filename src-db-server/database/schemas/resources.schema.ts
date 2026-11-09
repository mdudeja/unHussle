import { sqliteTable, text, index, unique } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { entitySchema } from './common.schema'
import type { Entity, InferTableTypes } from '@c/types/index'
import { junctionTags } from './junction.tags.schema'
import { junctionUrls } from './junction.urls.schema'
import { junctionResources } from './junction.resources.schema'

// Resources link to tasks and collections through `junction_resources`, so
// they don't carry the entity foreign keys.
const {
  project_id: _project_id,
  area_id: _area_id,
  goal_id: _goal_id,
  ...resourceColumns
} = entitySchema

export const resources = sqliteTable(
  'resources',
  {
    ...resourceColumns,
    /** Path of the markdown file, relative to the vault root. */
    file_path: text('file_path'),
    /** sha256 of the file content as last written or read by the app. */
    content_hash: text('content_hash'),
  },
  (table) => [
    index('resources_title_idx').on(table.title),
    index('resources_created_at_idx').on(table.created_at),
    index('resources_updated_at_idx').on(table.updated_at),
    unique('resources_title_unique').on(table.title),
    unique('resources_file_path_unique').on(table.file_path),
  ],
)

export const resourcesRelations = relations(resources, ({ many }) => ({
  tags: many(junctionTags),
  urls: many(junctionUrls),
  links: many(junctionResources),
}))

export type Resource = InferTableTypes<Entity, typeof resources>
