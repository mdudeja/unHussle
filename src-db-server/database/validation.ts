import { createInsertSchema, createSelectSchema } from 'drizzle-typebox'
import {
  tasksSchema,
  areasSchema,
  goalsSchema,
  projectsSchema,
  entityTagsSchema,
} from '@d/database/schemas/index'
import { t } from 'elysia'
import { ProgressStatus, Priority } from '@c/index'

// Tasks
export const insertTaskSchema = createInsertSchema(tasksSchema, {
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),

  // Handle JSON arrays, drizzle-typebox sometimes misses these
  tag_ids: t.Optional(t.Array(t.String())),
  url_ids: t.Optional(t.Array(t.String())),
  time_entry_ids: t.Optional(t.Array(t.String())),
})

export const updateTaskSchema = t.Partial(insertTaskSchema)
export const selectTaskSchema = createSelectSchema(tasksSchema)

// Areas
export const insertAreaSchema = createInsertSchema(areasSchema, {
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),
})
export const updateAreaSchema = t.Partial(insertAreaSchema)
export const selectAreaSchema = createSelectSchema(areasSchema)

// Goals
export const insertGoalSchema = createInsertSchema(goalsSchema, {
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),
})
export const updateGoalSchema = t.Partial(insertGoalSchema)
export const selectGoalSchema = createSelectSchema(goalsSchema)

// Projects
export const insertProjectSchema = createInsertSchema(projectsSchema, {
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),
})
export const updateProjectSchema = t.Partial(insertProjectSchema)
export const selectProjectSchema = createSelectSchema(projectsSchema)

// Tags
export const insertEntityTagsSchema = createInsertSchema(entityTagsSchema)
export const updateEntityTagsSchema = t.Partial(insertEntityTagsSchema)
export const selectEntityTagsSchema = createSelectSchema(entityTagsSchema)
