import { index, sqliteTable, unique } from 'drizzle-orm/sqlite-core'
import { junctionTableSchema } from './common.schema'
import { InferTableTypes, JunctionTable } from '@c/index'
import { relations } from 'drizzle-orm'
import { tasksSchema, timeEntriesSchema } from '.'

export const junctionTimeEntriesSchema = sqliteTable(
  'junction_time_entries',
  {
    ...junctionTableSchema,
  },
  (table) => [
    index('junction_time_entries_attachedToId_refId_idx').on(
      table.attachedToId,
      table.refId,
    ),
    unique('junction_time_entries_attachedToId_refId_unique').on(
      table.attachedToId,
      table.refId,
    ),
  ],
)

export const junctionTimeEntriesRelations = relations(
  junctionTimeEntriesSchema,
  ({ one }) => ({
    task: one(tasksSchema, {
      fields: [junctionTimeEntriesSchema.attachedToId],
      references: [tasksSchema.id],
    }),
    timeEntry: one(timeEntriesSchema, {
      fields: [junctionTimeEntriesSchema.refId],
      references: [timeEntriesSchema.id],
    }),
  }),
)

export type JunctionTimeEntries = InferTableTypes<
  JunctionTable,
  typeof junctionTimeEntriesSchema
>
