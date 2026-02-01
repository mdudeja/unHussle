import {
  index,
  sqliteTable,
  unique,
  text,
  primaryKey,
} from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { junctionTableSchema } from '@d/database/schemas/common.schema'
import {
  tasks,
  urls,
  resources,
  projects,
  areas,
  goals,
} from '@d/database/schemas/index'
import { InferTableTypes, JunctionTable } from '@c/index'

export const junctionUrls = sqliteTable(
  'junction_urls',
  {
    ...junctionTableSchema,
    refId: text()
      .notNull()
      .references(() => urls.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => [
    primaryKey({
      columns: [table.attachedToId, table.refId],
    }),
    index('junction_urls_attachedToId_refId_idx').on(
      table.attachedToId,
      table.refId,
    ),
    unique('junction_urls_attachedToId_refId_unique').on(
      table.attachedToId,
      table.refId,
    ),
  ],
)

export const junctionUrlsRelations = relations(junctionUrls, ({ one }) => ({
  task: one(tasks, {
    fields: [junctionUrls.attachedToId],
    references: [tasks.id],
  }),
  resource: one(resources, {
    fields: [junctionUrls.attachedToId],
    references: [resources.id],
  }),
  project: one(projects, {
    fields: [junctionUrls.attachedToId],
    references: [projects.id],
  }),
  area: one(areas, {
    fields: [junctionUrls.attachedToId],
    references: [areas.id],
  }),
  goal: one(goals, {
    fields: [junctionUrls.attachedToId],
    references: [goals.id],
  }),
  url: one(urls, {
    fields: [junctionUrls.refId],
    references: [urls.id],
  }),
}))

export type JunctionUrls = InferTableTypes<JunctionTable, typeof junctionUrls>
