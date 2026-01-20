import { sqliteTable } from 'drizzle-orm/sqlite-core'
import { entityCollectionSchema } from './common.schema'
import { EntityCollection, InferTableTypes } from '@/types'

export const areasSchema = sqliteTable('areas', {
  ...entityCollectionSchema,
})

export type Area = InferTableTypes<EntityCollection, typeof areasSchema>
