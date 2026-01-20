import { Priority, ProgressStatus } from '@/types'
import { sql } from 'drizzle-orm'
import * as t from 'drizzle-orm/sqlite-core'
import { entityTagsSchema } from './entity_tags.schema'
import { entityUrlsSchema } from './entity_urls.schema'
import { projectsSchema } from './projects.schema'
import { areasSchema } from './areas.schema'
import { goalsSchema } from './goals.schema'

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
  project_id: t.text('project_id').references(() => projectsSchema.id, {
    onDelete: 'set null',
  }),
  area_id: t.text('area_id').references(() => areasSchema.id, {
    onDelete: 'set null',
  }),
  goal_id: t.text('goal_id').references(() => goalsSchema.id, {
    onDelete: 'set null',
  }),
  tag_ids: t
    .text({ mode: 'json' })
    .$type<string[]>()
    .references(() => entityTagsSchema.id, {
      onDelete: 'set null',
    })
    .default([]),
  url_ids: t
    .text({ mode: 'json' })
    .$type<string[]>()
    .references(() => entityUrlsSchema.id, {
      onDelete: 'set null',
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
