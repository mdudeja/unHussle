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
  tasks,
  tags,
  resources,
  projects,
  areas,
  goals,
} from '@d/database/schemas/index'
import { InferTableTypes, JunctionTable } from '@c/types/index'

export const junctionTags = sqliteTable(
  'junction_tags',
  {
    ...junctionTableSchema,
    refId: text()
      .notNull()
      .references(() => tags.id, {
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

export const junctionTagsRelations = relations(junctionTags, ({ one }) => ({
  task: one(tasks, {
    fields: [junctionTags.attachedToId],
    references: [tasks.id],
  }),
  resource: one(resources, {
    fields: [junctionTags.attachedToId],
    references: [resources.id],
  }),
  project: one(projects, {
    fields: [junctionTags.attachedToId],
    references: [projects.id],
  }),
  area: one(areas, {
    fields: [junctionTags.attachedToId],
    references: [areas.id],
  }),
  goal: one(goals, {
    fields: [junctionTags.attachedToId],
    references: [goals.id],
  }),
  tag: one(tags, {
    fields: [junctionTags.refId],
    references: [tags.id],
  }),
}))

export type JunctionTags = InferTableTypes<JunctionTable, typeof junctionTags>
