import { Priority, ProgressStatus } from '@/types'
import { sql } from 'drizzle-orm'
import * as t from 'drizzle-orm/sqlite-core'
import { entityTagsSchema } from './entity_tags.schema'
import { entityUrlsSchema } from './entity_urls.schema'

// Enums
const customEnum = <T>(name: string) =>
  t.customType<{
    data: T
  }>({
    dataType() {
      return 'text'
    },
  })(name)

// Common Schemas
export const timestampsSchema = {
  created_at: t
    .integer({ mode: 'timestamp_ms' })
    .notNull()
    .$default(() => sql`(CURRENT_TIMESTAMP)`),
  updated_at: t
    .integer({ mode: 'timestamp_ms' })
    .notNull()
    .$onUpdate(() => sql`(CURRENT_TIMESTAMP)`),
}

export const prioritySchema = {
  priority: customEnum<Priority>('priority').notNull().default(Priority.MEDIUM),
}

export const statusSchema = {
  status: customEnum<ProgressStatus>('status')
    .notNull()
    .default(ProgressStatus.PLANNED),
}

// Parent Schemas
export const entitySchema = {
  id: t.text().primaryKey(),
  title: t.text().notNull(),
  description: t.text(),
  project_id: t.text('project_id'),
  area_id: t.text('area_id'),
  goal_id: t.text('goal_id'),
  tag_ids: t
    .text({ mode: 'json' })
    .$type<string[]>()
    .references(() => entityTagsSchema.id, {
      onDelete: 'cascade',
    })
    .default([]),
  url_ids: t
    .text({ mode: 'json' })
    .$type<string[]>()
    .references(() => entityUrlsSchema.id, {
      onDelete: 'cascade',
    })
    .default([]),
  ...timestampsSchema,
}

export const entityCollectionSchema = {
  id: t.text().primaryKey(),
  title: t.text().notNull(),
  ...statusSchema,
  ...prioritySchema,
  icon: t.text(),
  color: t.text(),
  description: t.text(),
  ...timestampsSchema,
}

export const entitySupporterSchema = {
  id: t.text().primaryKey(),
  description: t.text(),
  ...timestampsSchema,
}
