import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { entitySupporterSchema } from './common.schema'
import { EntitySupporter, InferTableTypes } from '@c/index'

export const entityTagsSchema = sqliteTable('entity_tags', {
  ...entitySupporterSchema,
  title: text().notNull(),
  color: text(),
})

export type EntityTag = InferTableTypes<
  EntitySupporter,
  typeof entityTagsSchema
>
