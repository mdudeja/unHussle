import { createInsertSchema, createSelectSchema } from 'drizzle-typebox'
import { tasksSchema } from '@d/database/schemas/tasks.schema'
import { t } from 'elysia'
import { ProgressStatus, Priority } from '@c/index'

export const insertTaskSchema = createInsertSchema(tasksSchema, {
  status: t.Enum(ProgressStatus),
  priority: t.Enum(Priority),

  // Handle JSON arrays if needed, drizzle-typebox sometimes misses these
  tag_ids: t.Optional(t.Array(t.String())),
  url_ids: t.Optional(t.Array(t.String())),
  time_entry_ids: t.Optional(t.Array(t.String())),
})

export const updateTaskSchema = t.Partial(insertTaskSchema)
export const selectTaskSchema = createSelectSchema(tasksSchema)
