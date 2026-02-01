import { sqliteTable, text, index, unique } from 'drizzle-orm/sqlite-core'
import { entitySupporterSchema } from '@d/database/schemas/index'
import { EntitySupporter, InferTableTypes } from '@c/index'

export const tags = sqliteTable(
  'tags',
  {
    ...entitySupporterSchema,
    title: text().notNull(),
    color: text(),
  },
  (table) => [
    index('tags_title_idx').on(table.title),
    unique('tags_title_unique').on(table.title),
  ],
)

export type Tag = InferTableTypes<EntitySupporter, typeof tags>
