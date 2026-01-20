import { real, sqliteTable, integer } from 'drizzle-orm/sqlite-core'
import { entityCollectionSchema } from './common.schema'
import { EntityCollection, InferTableTypes } from '@/types'

export const goalsSchema = sqliteTable('goals', {
  ...entityCollectionSchema,
  due_date: integer({ mode: 'timestamp_ms' }),
  progress: real().notNull().default(0),
})

export type Goal = InferTableTypes<EntityCollection, typeof goalsSchema>
