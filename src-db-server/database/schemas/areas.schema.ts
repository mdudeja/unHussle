import { sqliteTable } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { entityCollectionSchema } from './common.schema'
import { EntityCollection, InferTableTypes } from '@c/index'
import { tasksSchema } from './tasks.schema'
import { resourcesSchema } from './resources.schema'
import { projectsSchema } from './projects.schema'

export const areasSchema = sqliteTable('areas', {
  ...entityCollectionSchema,
})

export const areasRelations = relations(areasSchema, ({ many }) => ({
  tasks: many(tasksSchema),
  resources: many(resourcesSchema),
  projects: many(projectsSchema),
}))

export type Area = InferTableTypes<EntityCollection, typeof areasSchema>
