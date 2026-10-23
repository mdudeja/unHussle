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

// Tags/URLs accepted alongside an entity on POST/PATCH
export const tagInputSchema = t.Object({
  ...insertTagsSchema.properties,
})
export const urlInputSchema = t.Object({
  ...insertUrlsSchema.properties,
})
const attachmentsSchema = {
  tags: t.Optional(t.Array(tagInputSchema)),
  urls: t.Optional(t.Array(urlInputSchema)),
}

// Tasks
export const insertTaskSchema = Type.Object({
  ...createInsertSchema(tasks, {
    status: t.Optional(t.Enum(ProgressStatus)),
    priority: t.Optional(t.Enum(Priority)),
  }).properties,
  ...attachmentsSchema,
})

export const updateTaskSchema = t.Partial(insertTaskSchema)
export const selectTaskBaseSchema = createSelectSchema(tasks)

// Resources
export const insertResourceSchema = createInsertSchema(resources)

export const updateResourceSchema = t.Partial(insertResourceSchema)
export const selectResourceBaseSchema = createSelectSchema(resources)

// Areas
export const insertAreaSchema = Type.Object({
  ...createInsertSchema(areas, {
    status: t.Optional(t.Enum(ProgressStatus)),
    priority: t.Optional(t.Enum(Priority)),
  }).properties,
  ...attachmentsSchema,
})
export const updateAreaSchema = t.Partial(insertAreaSchema)
export const selectAreaBaseSchema = createSelectSchema(areas)

// Goals
export const insertGoalSchema = Type.Object({
  ...createInsertSchema(goals, {
    status: t.Optional(t.Enum(ProgressStatus)),
    priority: t.Optional(t.Enum(Priority)),
  }).properties,
  ...attachmentsSchema,
})
export const updateGoalSchema = t.Partial(insertGoalSchema)
export const selectGoalBaseSchema = createSelectSchema(goals)

// Projects
export const insertProjectSchema = Type.Object({
  ...createInsertSchema(projects, {
    status: t.Optional(t.Enum(ProgressStatus)),
    priority: t.Optional(t.Enum(Priority)),
  }).properties,
  ...attachmentsSchema,
})
export const updateProjectSchema = t.Partial(insertProjectSchema)
export const selectProjectBaseSchema = createSelectSchema(projects)

// select schemas with relations
export const selectTaskSchema = Type.Object({
  ...selectTaskBaseSchema.properties,
  project: Type.Optional(Type.Union([selectProjectBaseSchema, Type.Null()])),
  area: Type.Optional(Type.Union([selectAreaBaseSchema, Type.Null()])),
  goal: Type.Optional(Type.Union([selectGoalBaseSchema, Type.Null()])),
  anchor: Type.Optional(Type.Union([selectTaskBaseSchema, Type.Null()])),
  tags: Type.Optional(Type.Array(selectTagsSchema)),
  urls: Type.Optional(Type.Array(selectUrlsSchema)),
  timeEntries: Type.Optional(Type.Array(selectTimeEntriesSchema)),
})

export const selectResourceSchema = Type.Object({
  ...selectResourceBaseSchema.properties,
  project: Type.Optional(Type.Union([selectProjectBaseSchema, Type.Null()])),
  area: Type.Optional(Type.Union([selectAreaBaseSchema, Type.Null()])),
  goal: Type.Optional(Type.Union([selectGoalBaseSchema, Type.Null()])),
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
  area: Type.Optional(Type.Union([selectAreaBaseSchema, Type.Null()])),
  tasks: Type.Optional(Type.Array(selectTaskBaseSchema)),
  resources: Type.Optional(Type.Array(selectResourceBaseSchema)),
  projects: Type.Optional(Type.Array(selectProjectBaseSchema)),
  tags: Type.Optional(Type.Array(selectTagsSchema)),
  urls: Type.Optional(Type.Array(selectUrlsSchema)),
})

export const selectProjectSchema = Type.Object({
  ...selectProjectBaseSchema.properties,
  area: Type.Optional(Type.Union([selectAreaBaseSchema, Type.Null()])),
  goal: Type.Optional(Type.Union([selectGoalBaseSchema, Type.Null()])),
  tasks: Type.Optional(Type.Array(selectTaskBaseSchema)),
  resources: Type.Optional(Type.Array(selectResourceBaseSchema)),
  tags: Type.Optional(Type.Array(selectTagsSchema)),
  urls: Type.Optional(Type.Array(selectUrlsSchema)),
})

// Items linked to a tag, grouped by entity type
export const selectTagItemsSchema = Type.Object({
  tasks: Type.Array(selectTaskSchema),
  projects: Type.Array(selectProjectSchema),
  areas: Type.Array(selectAreaSchema),
  goals: Type.Array(selectGoalSchema),
})
