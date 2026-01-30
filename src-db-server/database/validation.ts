import { createInsertSchema, createSelectSchema } from 'drizzle-typebox'
import {
  tasksSchema,
  areasSchema,
  goalsSchema,
  projectsSchema,
  tagsSchema,
  resourcesSchema,
  urlsSchema,
  timeEntriesSchema,
} from '@d/database/schemas/index'
import { t } from 'elysia'
import { ProgressStatus, Priority } from '@c/index'

// Tasks
export const insertTaskSchema = createInsertSchema(tasksSchema, {
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),
})

export const updateTaskSchema = t.Partial(insertTaskSchema)
export const selectTaskSchema = createSelectSchema(tasksSchema)

// Resources
export const insertResourceSchema = createInsertSchema(resourcesSchema)

export const updateResourceSchema = t.Partial(insertResourceSchema)
export const selectResourceSchema = createSelectSchema(resourcesSchema)

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
export const insertTagsSchema = createInsertSchema(tagsSchema)
export const updateTagsSchema = t.Partial(insertTagsSchema)
export const selectTagsSchema = createSelectSchema(tagsSchema)

// URLs
export const insertUrlsSchema = createInsertSchema(urlsSchema)
export const updateUrlsSchema = t.Partial(insertUrlsSchema)
export const selectUrlsSchema = createSelectSchema(urlsSchema)

// Time entries
export const insertTimeEntriesSchema = createInsertSchema(timeEntriesSchema)
export const updateTimeEntriesSchema = t.Partial(insertTimeEntriesSchema)
export const selectTimeEntriesSchema = createSelectSchema(timeEntriesSchema)
