import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { entityCollectionSchema } from './common.schema'
import { goalsSchema } from './goals.schema'
import { areasSchema } from './areas.schema'
import { EntityCollection, InferTableTypes } from '@/types'
import { tasksSchema } from './tasks.schema'
import { resourcesSchema } from './resources.schema'

export const projectsSchema = sqliteTable('projects', {
  ...entityCollectionSchema,
  area_id: text().references(() => areasSchema.id),
  goal_id: text().references(() => goalsSchema.id),
  due_date: integer({ mode: 'timestamp_ms' }),
})

export const projectsRelations = relations(projectsSchema, ({ one, many }) => ({
  area: one(areasSchema, {
    fields: [projectsSchema.area_id],
    references: [areasSchema.id],
  }),
  goal: one(goalsSchema, {
    fields: [projectsSchema.goal_id],
    references: [goalsSchema.id],
  }),
  tasks: many(tasksSchema),
  resources: many(resourcesSchema),
}))

export type Project = InferTableTypes<EntityCollection, typeof projectsSchema>
