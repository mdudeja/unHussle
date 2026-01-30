import {
  real,
  sqliteTable,
  integer,
  index,
  unique,
} from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { entityCollectionSchema } from './common.schema'
import { EntityCollection, InferTableTypes } from '@c/index'
import { tasksSchema } from './tasks.schema'
import { resourcesSchema } from './resources.schema'
import { projectsSchema } from './projects.schema'
import { junctionTagsSchema } from './junction.tags.schema'
import { junctionUrlsSchema } from './junction.urls.schema'

export const goalsSchema = sqliteTable(
  'goals',
  {
    ...entityCollectionSchema,
    due_date: integer({ mode: 'timestamp_ms' }),
    progress: real().notNull().default(0),
  },
  (table) => [
    index('goals_title_idx').on(table.title),
    index('goals_due_date_idx').on(table.due_date),
    index('goals_status_idx').on(table.status),
    index('goals_priority_idx').on(table.priority),
    unique('goals_title_unique').on(table.title),
  ],
)

export const goalsRelations = relations(goalsSchema, ({ many }) => ({
  tasks: many(tasksSchema),
  resources: many(resourcesSchema),
  projects: many(projectsSchema),
  tags: many(junctionTagsSchema),
  urls: many(junctionUrlsSchema),
}))

export type Goal = InferTableTypes<EntityCollection, typeof goalsSchema>
