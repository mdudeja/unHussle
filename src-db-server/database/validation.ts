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
  dayPlans,
  planItems,
  schedulerSettings,
  schedulingOverrides,
  taskOccurrences,
} from '@d/database/schemas/index'
import { t } from 'elysia'
import { AnchorType, ProgressStatus, Priority } from '@c/types/index'
import {
  adjustActions,
  dayModeChanges,
  planRuleNames,
  scheduleCues,
  wrapReasons,
} from '@c/scheduler/contracts'
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
  goals: Type.Optional(Type.Array(selectGoalBaseSchema)),
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

// Scheduler
const calendarDate = t.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' })
const nullablePriority = t.Union([t.Enum(Priority), t.Null()])
const schedulerWindow = { wake: t.String(), sleep: t.String() }
const planRules = t.Array(t.UnionEnum(planRuleNames))

// drizzle-typebox sees the settings column as untyped JSON, so its shape is given here.
export const schedulerSettingsSchema = createSelectSchema(schedulerSettings, {
  settings: t.Object({
    ...schedulerWindow,
    workTags: t.Array(t.String({ minLength: 1 })),
    workMinutes: t.Number(),
    defaultMinutes: t.Number(),
    quickMinutes: t.Number(),
    starterMinutes: t.Number(),
    longMinutes: t.Number(),
    wrapMinutes: t.Number(),
    overrides: t.Record(
      t.String(),
      t.Object({ ...schedulerWindow, workMinutes: t.Optional(t.Number()) }),
    ),
    rules: t.Optional(
      t.Partial(
        t.Object({
          fresh: planRules,
          break: planRules,
          wrap: planRules,
          more: planRules,
        }),
      ),
    ),
  }),
}).properties.settings

export const selectDayPlanBaseSchema = createSelectSchema(dayPlans, {
  date: calendarDate,
  revision: t.Integer({ minimum: 0 }),
  conflicts: t.Array(t.String()),
  wrapReason: t.Union([t.UnionEnum(wrapReasons), t.Null()]),
})
export const selectPlanItemSchema = createSelectSchema(planItems)
export const selectOccurrenceSchema = createSelectSchema(taskOccurrences)
const insertOverrideSchema = createInsertSchema(schedulingOverrides, {
  availableDate: calendarDate,
})

// Day reads and plan commands address a plan by its date and timezone.
const { date, timezone, revision } = selectDayPlanBaseSchema.properties
export const schedulerDayParamsSchema = t.Object({ date })
export const schedulerDayQuerySchema = t.Object({ timezone })
export const generatePlanSchema = t.Object({
  date,
  timezone,
  revision: t.Optional(revision),
})
export const replanSchema = t.Object({
  ...generatePlanSchema.properties,
  cue: t.Optional(t.UnionEnum(scheduleCues)),
})
export const changeModeSchema = t.Object({
  ...generatePlanSchema.properties,
  change: t.UnionEnum(dayModeChanges),
  reason: t.Optional(t.UnionEnum(wrapReasons)),
})
export const adjustPlanSchema = t.Object({
  ...generatePlanSchema.properties,
  itemId: selectPlanItemSchema.properties.itemId,
  action: t.UnionEnum(adjustActions),
  until: t.Optional(insertOverrideSchema.properties.availableDate),
  position: t.Optional(selectPlanItemSchema.properties.position),
})
export const stopTrackingSchema = t.Object({
  taskId: selectTimeEntriesSchema.properties.task_id,
  occurrenceId: selectTimeEntriesSchema.properties.occurrence_id,
  at: t.Number(),
})
export const transitionOccurrenceSchema = t.Object({
  id: selectOccurrenceSchema.properties.id,
  status: t.Enum(ProgressStatus),
})

// Plan entries combine a task (or occurrence) with its saved plan item.
const task = createSelectSchema(tasks, {
  priority: nullablePriority,
  anchor_type: t.Union([t.Enum(AnchorType), t.Null()]),
}).properties
const collectionPriority = {
  project: createSelectSchema(projects, { priority: nullablePriority })
    .properties.priority,
  goal: createSelectSchema(goals, { priority: nullablePriority }).properties
    .priority,
  area: createSelectSchema(areas, { priority: nullablePriority }).properties
    .priority,
}
const item = selectPlanItemSchema.properties
const occurrence = selectOccurrenceSchema.properties
const instant = Type.Union([Type.Number(), Type.Null()])

export const selectPlanEntrySchema = Type.Object({
  id: item.itemId,
  taskId: task.id,
  taskData: task.custom_data,
  occurrenceId: item.occurrenceId,
  title: task.title,
  status: item.status,
  /** Estimated minutes still remaining. */
  minutes: Type.Number(),
  spentMinutes: occurrence.spentMinutes,
  isWork: Type.Boolean(),
  isFun: task.is_fun,
  isChore: task.is_chore,
  isQuick: task.is_quick,
  fixedStart: task.scheduled_start,
  fixedEnd: task.scheduled_end,
  windowStart: instant,
  windowEnd: instant,
  due: task.due_date,
  anchorId: task.anchor_id,
  anchorType: task.anchor_type,
  anchorSlot: task.anchor_slot,
  anchorSatisfied: Type.Optional(Type.Boolean()),
  priorities: Type.Tuple([
    task.priority,
    collectionPriority.project,
    collectionPriority.goal,
    collectionPriority.area,
  ]),
  createdAt: task.created_at,
  pinned: item.pinned,
  reason: Type.String(),
  startedAt: Type.Optional(selectTimeEntriesSchema.properties.start_time),
})

// A plan is addressed by its date and timezone, so its row id isn't sent.
const { id: _planId, ...dayPlan } = selectDayPlanBaseSchema.properties
export const selectDayPlanSchema = Type.Object({
  ...dayPlan,
  entries: Type.Array(selectPlanEntrySchema),
  saved: Type.Boolean(),
  workUsed: Type.Number(),
  workPlanned: Type.Number(),
  capacityMinutes: Type.Number(),
  backlogCount: Type.Number(),
  settings: schedulerSettingsSchema,
})

export const selectNextTaskSchema = Type.Object({
  item: Type.Union([selectPlanEntrySchema, Type.Null()]),
  upcoming: Type.Union([selectPlanEntrySchema, Type.Null()]),
  plan: selectDayPlanSchema,
})
