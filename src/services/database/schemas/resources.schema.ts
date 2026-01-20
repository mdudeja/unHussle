import { sqliteTable } from 'drizzle-orm/sqlite-core'
import { entitySchema } from './common.schema'
import { Entity, InferTableTypes } from '@/types'

export const resourcesSchema = sqliteTable('resources', {
  ...entitySchema,
})

export type Resource = InferTableTypes<Entity, typeof resourcesSchema>
