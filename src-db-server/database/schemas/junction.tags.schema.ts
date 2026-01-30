import {
  sqliteTable,
  index,
  unique,
  text,
  primaryKey,
} from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'
import { junctionTableSchema } from '@d/database/schemas/common.schema'
import {
  tasksSchema,
  tagsSchema,
  resourcesSchema,
  projectsSchema,
  areasSchema,
  goalsSchema,
} from '@d/database/schemas/index'
import { InferTableTypes, JunctionTable } from '@c/index'

export const junctionTagsSchema = sqliteTable(
  'junction_tags',
  {
    ...junctionTableSchema,
    refId: text()
      .notNull()
      .references(() => tagsSchema.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => [
    primaryKey({
      columns: [table.attachedToId, table.refId],
    }),
    index('junction_tags_attachedToId_refId_idx').on(
      table.attachedToId,
      table.refId,
    ),
    unique('junction_tags_attachedToId_refId_unique').on(
      table.attachedToId,
      table.refId,
    ),
  ],
)

export const junctionTagsRelations = relations(
  junctionTagsSchema,
  ({ one }) => ({
    task: one(tasksSchema, {
      fields: [junctionTagsSchema.attachedToId],
      references: [tasksSchema.id],
    }),
    resource: one(resourcesSchema, {
      fields: [junctionTagsSchema.attachedToId],
      references: [resourcesSchema.id],
    }),
    project: one(projectsSchema, {
      fields: [junctionTagsSchema.attachedToId],
      references: [projectsSchema.id],
    }),
    area: one(areasSchema, {
      fields: [junctionTagsSchema.attachedToId],
      references: [areasSchema.id],
    }),
    goal: one(goalsSchema, {
      fields: [junctionTagsSchema.attachedToId],
      references: [goalsSchema.id],
    }),
    tag: one(tagsSchema, {
      fields: [junctionTagsSchema.refId],
      references: [tagsSchema.id],
    }),
  }),
)

export type JunctionTags = InferTableTypes<
  JunctionTable,
  typeof junctionTagsSchema
>
