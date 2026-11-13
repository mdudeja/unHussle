import {
  real,
  sqliteTable,
  integer,
  index,
  unique,
  text,
} from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { entityCollectionSchema, statusSchema } from './common.schema'
import type { EntityCollection, InferTableTypes } from '@c/types/index'
import { tasks } from './tasks.schema'
import { junctionResources } from './junction.resources.schema'
import { projects } from './projects.schema'
import { junctionTags } from './junction.tags.schema'
import { junctionUrls } from './junction.urls.schema'
import { areas } from './areas.schema'

export const goals = sqliteTable(
  'goals',
  {
    ...entityCollectionSchema,
    ...statusSchema,
    area_id: text().references(() => areas.id, { onDelete: 'set null' }),
    due_date: integer({ mode: 'number' }),
    progress: real().notNull().default(0),
    completed_at: integer({ mode: 'number' }),
    spent_minutes: integer({ mode: 'number' }),
  },
  (table) => [
    index('goals_title_idx').on(table.title),
    index('goals_due_date_idx').on(table.due_date),
    index('goals_status_idx').on(table.status),
    index('goals_priority_idx').on(table.priority),
    index('goals_created_at_idx').on(table.created_at),
    index('goals_updated_at_idx').on(table.updated_at),
    unique('goals_title_unique').on(table.title),
  ],
)

export const goalsRelations = relations(goals, ({ one, many }) => ({
  area: one(areas, {
    fields: [goals.area_id],
    references: [areas.id],
  }),
  tasks: many(tasks),
  resources: many(junctionResources),
  projects: many(projects),
  tags: many(junctionTags),
  urls: many(junctionUrls),
}))

export type Goal = InferTableTypes<EntityCollection, typeof goals>
