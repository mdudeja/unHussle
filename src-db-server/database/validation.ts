import { createInsertSchema, createSelectSchema } from 'drizzle-typebox'
import {
  tasks,
  areas,
  goals,
  projects,
  tags,
  resources,
  urls,
  timeEntries,
} from '@d/database/schemas/index'
import { t } from 'elysia'
import { ProgressStatus, Priority } from '@c/types/index'

// Tasks
export const insertTaskSchema = createInsertSchema(tasks, {
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),
})

export const updateTaskSchema = t.Partial(insertTaskSchema)
export const selectTaskSchema = createSelectSchema(tasks)

// Resources
export const insertResourceSchema = createInsertSchema(resources)

export const updateResourceSchema = t.Partial(insertResourceSchema)
export const selectResourceSchema = createSelectSchema(resources)

// Areas
export const insertAreaSchema = createInsertSchema(areas, {
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),
})
export const updateAreaSchema = t.Partial(insertAreaSchema)
export const selectAreaSchema = createSelectSchema(areas)

// Goals
export const insertGoalSchema = createInsertSchema(goals, {
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),
})
export const updateGoalSchema = t.Partial(insertGoalSchema)
export const selectGoalSchema = createSelectSchema(goals)

// Projects
export const insertProjectSchema = createInsertSchema(projects, {
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),
})
export const updateProjectSchema = t.Partial(insertProjectSchema)
export const selectProjectSchema = createSelectSchema(projects)

// Tags
export const insertTagsSchema = createInsertSchema(tags)
export const updateTagsSchema = t.Partial(insertTagsSchema)
export const selectTagsSchema = createSelectSchema(tags)

// URLs
export const insertUrlsSchema = createInsertSchema(urls, {
  url: t.String({ format: 'uri' }),
})
export const updateUrlsSchema = t.Partial(insertUrlsSchema)
export const selectUrlsSchema = createSelectSchema(urls)

// Time entries
export const insertTimeEntriesSchema = createInsertSchema(timeEntries)
export const updateTimeEntriesSchema = t.Partial(insertTimeEntriesSchema)
export const selectTimeEntriesSchema = createSelectSchema(timeEntries)
