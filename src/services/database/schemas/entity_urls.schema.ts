import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { entitySupporterSchema } from './common.schema'
import { EntitySupporter, InferTableTypes } from '@/types'

export const entityUrlsSchema = sqliteTable('entity_urls', {
  ...entitySupporterSchema,
  title: text(),
  url: text().notNull(),
  protocol: text().notNull(),
  domain: text().notNull(),
  path: text().notNull(),
  query: text().notNull(),
  fragment: text().notNull(),
})

export type EntityUrl = InferTableTypes<
  EntitySupporter,
  typeof entityUrlsSchema
>
