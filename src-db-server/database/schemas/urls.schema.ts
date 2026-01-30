import { sqliteTable, text, index, unique } from 'drizzle-orm/sqlite-core'
import { entitySupporterSchema } from './common.schema'
import { EntitySupporter, InferTableTypes } from '@c/index'

export const urlsSchema = sqliteTable(
  'urls',
  {
    ...entitySupporterSchema,
    title: text(),
    url: text().notNull(),
    protocol: text().notNull(),
    domain: text().notNull(),
    path: text().notNull(),
    query: text().notNull(),
    fragment: text().notNull(),
  },
  (table) => [
    index('urls_title_idx').on(table.title),
    index('urls_domain_idx').on(table.domain),
    index('urls_path_idx').on(table.path),
    unique('urls_url_unique').on(table.url),
  ],
)

export type EntityUrl = InferTableTypes<EntitySupporter, typeof urlsSchema>
