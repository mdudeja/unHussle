import { sqliteTable, text, index, unique } from 'drizzle-orm/sqlite-core'
import { entitySupporterSchema } from './common.schema'
import { EntitySupporter, InferTableTypes } from '@c/types/index'

export const urls = sqliteTable(
  'urls',
  {
    ...entitySupporterSchema,
    title: text(),
    url: text().notNull(),
    parts: text({ mode: 'json' })
      .$type<{
        protocol: string
        hostname: string
        pathname: string
        port?: string
        search?: string
        hash?: string
      }>()
      .default({
        protocol: '',
        hostname: '',
        pathname: '',
      }),
  },
  (table) => [
    index('urls_title_idx').on(table.title),
    index('urls_url_idx').on(table.url),
    index('urls_parts_idx').on(table.parts),
    unique('urls_url_unique').on(table.url),
  ],
)

export type Url = InferTableTypes<EntitySupporter, typeof urls>
