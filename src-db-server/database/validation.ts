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
import { Type } from '@sinclair/typebox'

// Tasks
export const insertTaskSchema = createInsertSchema(tasks, {
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),
})

export const updateTaskSchema = t.Partial(insertTaskSchema)
export const selectTaskBaseSchema = createSelectSchema(tasks)

// Resources
export const insertResourceSchema = createInsertSchema(resources)

export const updateResourceSchema = t.Partial(insertResourceSchema)
export const selectResourceBaseSchema = createSelectSchema(resources)

// Areas
export const insertAreaSchema = createInsertSchema(areas, {
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),
})
export const updateAreaSchema = t.Partial(insertAreaSchema)
export const selectAreaBaseSchema = createSelectSchema(areas)

// Goals
export const insertGoalSchema = createInsertSchema(goals, {
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),
})
export const updateGoalSchema = t.Partial(insertGoalSchema)
export const selectGoalBaseSchema = createSelectSchema(goals)

// Projects
export const insertProjectSchema = createInsertSchema(projects, {
  status: t.Optional(t.Enum(ProgressStatus)),
  priority: t.Optional(t.Enum(Priority)),
})
export const updateProjectSchema = t.Partial(insertProjectSchema)
export const selectProjectBaseSchema = createSelectSchema(projects)

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

// select schemas with relations
export const selectTaskSchema = Type.Object({
  ...selectTaskBaseSchema.properties,
  project: Type.Optional(selectProjectBaseSchema),
  area: Type.Optional(selectAreaBaseSchema),
  goal: Type.Optional(selectGoalBaseSchema),
  anchor: Type.Optional(selectTaskBaseSchema),
  tags: Type.Optional(Type.Array(selectTagsSchema)),
  urls: Type.Optional(Type.Array(selectUrlsSchema)),
  timeEntries: Type.Optional(Type.Array(selectTimeEntriesSchema)),
})

export const selectResourceSchema = Type.Object({
  ...selectResourceBaseSchema.properties,
  project: Type.Optional(selectProjectBaseSchema),
  area: Type.Optional(selectAreaBaseSchema),
  goal: Type.Optional(selectGoalBaseSchema),
  tags: Type.Optional(Type.Array(selectTagsSchema)),
  urls: Type.Optional(Type.Array(selectUrlsSchema)),
})

export const selectAreaSchema = Type.Object({
  ...selectAreaBaseSchema.properties,
  tasks: Type.Optional(Type.Array(selectTaskBaseSchema)),
  resources: Type.Optional(Type.Array(selectResourceBaseSchema)),
  projects: Type.Optional(Type.Array(selectProjectBaseSchema)),
  tags: Type.Optional(Type.Array(selectTagsSchema)),
  urls: Type.Optional(Type.Array(selectUrlsSchema)),
})

export const selectGoalSchema = Type.Object({
  ...selectGoalBaseSchema.properties,
  area: Type.Optional(selectAreaBaseSchema),
  tasks: Type.Optional(Type.Array(selectTaskBaseSchema)),
  resources: Type.Optional(Type.Array(selectResourceBaseSchema)),
  projects: Type.Optional(Type.Array(selectProjectBaseSchema)),
  tags: Type.Optional(Type.Array(selectTagsSchema)),
  urls: Type.Optional(Type.Array(selectUrlsSchema)),
})

export const selectProjectSchema = Type.Object({
  ...selectProjectBaseSchema.properties,
  area: Type.Optional(selectAreaBaseSchema),
  goal: Type.Optional(selectGoalBaseSchema),
  tasks: Type.Optional(Type.Array(selectTaskBaseSchema)),
  resources: Type.Optional(Type.Array(selectResourceBaseSchema)),
  tags: Type.Optional(Type.Array(selectTagsSchema)),
  urls: Type.Optional(Type.Array(selectUrlsSchema)),
})
