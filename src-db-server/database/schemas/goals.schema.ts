import { real, sqliteTable, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { entityCollectionSchema } from './common.schema'
import { EntityCollection, InferTableTypes } from '@c/index'
import { tasksSchema } from './tasks.schema'
import { resourcesSchema } from './resources.schema'
import { projectsSchema } from './projects.schema'

export const goalsSchema = sqliteTable('goals', {
  ...entityCollectionSchema,
  due_date: integer({ mode: 'timestamp_ms' }),
  progress: real().notNull().default(0),
})

export const goalsRelations = relations(goalsSchema, ({ many }) => ({
  tasks: many(tasksSchema),
  resources: many(resourcesSchema),
  projects: many(projectsSchema),
}))

export type Goal = InferTableTypes<EntityCollection, typeof goalsSchema>
