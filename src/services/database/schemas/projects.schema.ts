import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { entityCollectionSchema } from './common.schema'
import { goalsSchema } from './goals.schema'
import { areasSchema } from './areas.schema'
import { EntityCollection, InferTableTypes } from '@/types'

export const projectsSchema = sqliteTable('projects', {
  ...entityCollectionSchema,
  area_id: text().references(() => areasSchema.id),
  goal_id: text().references(() => goalsSchema.id),
  due_date: integer({ mode: 'timestamp_ms' }),
})

export type Project = InferTableTypes<EntityCollection, typeof projectsSchema>
