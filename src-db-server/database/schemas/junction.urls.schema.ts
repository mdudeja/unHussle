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
  tasksSchema,
  urlsSchema,
  resourcesSchema,
  projectsSchema,
  areasSchema,
  goalsSchema,
} from '@d/database/schemas/index'
import { InferTableTypes, JunctionTable } from '@c/index'

export const junctionUrlsSchema = sqliteTable(
  'junction_urls',
  {
    ...junctionTableSchema,
    refId: text()
      .notNull()
      .references(() => urlsSchema.id, {
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

export const junctionUrlsRelations = relations(
  junctionUrlsSchema,
  ({ one }) => ({
    task: one(tasksSchema, {
      fields: [junctionUrlsSchema.attachedToId],
      references: [tasksSchema.id],
    }),
    resource: one(resourcesSchema, {
      fields: [junctionUrlsSchema.attachedToId],
      references: [resourcesSchema.id],
    }),
    project: one(projectsSchema, {
      fields: [junctionUrlsSchema.attachedToId],
      references: [projectsSchema.id],
    }),
    area: one(areasSchema, {
      fields: [junctionUrlsSchema.attachedToId],
      references: [areasSchema.id],
    }),
    goal: one(goalsSchema, {
      fields: [junctionUrlsSchema.attachedToId],
      references: [goalsSchema.id],
    }),
    url: one(urlsSchema, {
      fields: [junctionUrlsSchema.refId],
      references: [urlsSchema.id],
    }),
  }),
)

export type JunctionUrls = InferTableTypes<
  JunctionTable,
  typeof junctionUrlsSchema
>
