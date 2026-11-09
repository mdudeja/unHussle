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
  resources,
  projects,
  areas,
  goals,
} from '@d/database/schemas/index'
import type { InferTableTypes, JunctionTable } from '@c/types/index'

// `attachedToId` is the task / project / area / goal a resource is linked to.
export const junctionResources = sqliteTable(
  'junction_resources',
  {
    ...junctionTableSchema,
    refId: text()
      .notNull()
      .references(() => resources.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => [
    primaryKey({
      columns: [table.attachedToId, table.refId],
    }),
    index('junction_resources_attachedToId_refId_idx').on(
      table.attachedToId,
      table.refId,
    ),
    index('junction_resources_refId_idx').on(table.refId),
    unique('junction_resources_attachedToId_refId_unique').on(
      table.attachedToId,
      table.refId,
    ),
  ],
)

export const junctionResourcesRelations = relations(
  junctionResources,
  ({ one }) => ({
    task: one(tasks, {
      fields: [junctionResources.attachedToId],
      references: [tasks.id],
    }),
    project: one(projects, {
      fields: [junctionResources.attachedToId],
      references: [projects.id],
    }),
    area: one(areas, {
      fields: [junctionResources.attachedToId],
      references: [areas.id],
    }),
    goal: one(goals, {
      fields: [junctionResources.attachedToId],
      references: [goals.id],
    }),
    resource: one(resources, {
      fields: [junctionResources.refId],
      references: [resources.id],
    }),
  }),
)

export type JunctionResources = InferTableTypes<
  JunctionTable,
  typeof junctionResources
>
