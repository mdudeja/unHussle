import {
  index,
  sqliteTable,
  unique,
  text,
  primaryKey,
} from 'drizzle-orm/sqlite-core'
import { junctionTableSchema } from './common.schema'
import type { InferTableTypes, JunctionTable } from '@c/types/index'
import { relations } from 'drizzle-orm'
import { tasks, timeEntries } from '.'

export const junctionTimeEntries = sqliteTable(
  'junction_time_entries',
  {
    ...junctionTableSchema,
    refId: text()
      .notNull()
      .references(() => timeEntries.id, {
        onDelete: 'cascade',
      }),
  },
  (table) => [
    primaryKey({
      columns: [table.attachedToId, table.refId],
    }),
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
  junctionTimeEntries,
  ({ one }) => ({
    task: one(tasks, {
      fields: [junctionTimeEntries.attachedToId],
      references: [tasks.id],
    }),
    timeEntry: one(timeEntries, {
      fields: [junctionTimeEntries.refId],
      references: [timeEntries.id],
    }),
  }),
)

export type JunctionTimeEntries = InferTableTypes<
  JunctionTable,
  typeof junctionTimeEntries
>
