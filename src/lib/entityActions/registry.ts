import { Priority, ProgressStatus } from '@c/types/index'
import { resolveTaskSchedule } from '@c/taskSchedule'
import { StoreState } from '@/store'
import {
  createAreaFields,
  createGoalFields,
  createProjectFields,
  createTagFields,
  createTaskFields,
  createUrlFields,
  FieldConfig,
} from '@/components/ui/custom/entityForms'
import type { EntityKind } from './types'

// Records the field builders may offer as select options.
export type FieldSources = Pick<StoreState, 'projects' | 'areas' | 'goals'>

type AnyEntity = { id: string } & Record<string, unknown>

// Mutation adapters keep action presentation independent of workflow details.
type RegistrySlice = {
  update(id: string, data: Record<string, unknown>): Promise<void>
  remove(id: string): Promise<void>
}

export type EntityRegistryEntry = {
  /** Singular, lowercase name, e.g. "task". */
  label: string
  selectSlice: (state: StoreState) => RegistrySlice
  // Each entity's fields are typed to its own record
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createFields: (sources: FieldSources) => FieldConfig<any>[]
  /** Used for form fields whose stored value is empty. */
  formDefaults?: Record<string, unknown>
  /** Derives values (e.g. a task's schedule) right before they are saved. */
  transformValues?: (values: Record<string, unknown>) => Record<string, unknown>
}

const statusDefaults = {
  status: ProgressStatus.PLANNED,
  priority: Priority.MEDIUM,
}

export const entityRegistry: Record<EntityKind, EntityRegistryEntry> = {
  tasks: {
    label: 'task',
    selectSlice: (state) => state.tasks,
    createFields: ({ projects, areas, goals }) =>
      createTaskFields({
        projects: projects.data,
        areas: areas.data,
        goals: goals.data,
      }),
    // The recurrence editor needs a rule to start from (see CreateTaskButton).
    formDefaults: {
      ...statusDefaults,
      recurrance_rule: { type: 'daily', data: {} },
    },
    transformValues: resolveTaskSchedule,
  },
  projects: {
    label: 'project',
    selectSlice: (state) => state.projects,
    createFields: ({ areas, goals }) =>
      createProjectFields({ areas: areas.data, goals: goals.data }),
    formDefaults: statusDefaults,
  },
  areas: {
    label: 'area',
    selectSlice: (state) => state.areas,
    createFields: () => createAreaFields(),
    formDefaults: statusDefaults,
  },
  goals: {
    label: 'goal',
    selectSlice: (state) => state.goals,
    createFields: ({ areas }) => createGoalFields({ areas: areas.data }),
    formDefaults: statusDefaults,
  },
  tags: {
    label: 'tag',
    selectSlice: (state) => state.tags,
    createFields: () => createTagFields(),
  },
  urls: {
    label: 'URL',
    selectSlice: (state) => state.urls,
    createFields: () => createUrlFields(),
  },
}

// URLs may have no title; fall back to the address.
export const getEntityTitle = (item: { id: string }) => {
  const { title, url } = item as Record<string, unknown>
  if (typeof title === 'string' && title) return title
  if (typeof url === 'string' && url) return url
  return item.id
}

/**
 * Form values for editing `item`: only the form's own fields, so read-only
 * columns (`id`, timestamps) and relation objects are never sent back.
 */
export const toFormValues = (
  item: AnyEntity,
  fields: Pick<FieldConfig<AnyEntity>, 'name'>[],
  defaults: Record<string, unknown> = {},
) =>
  Object.fromEntries(
    fields.map(({ name }) => [name, item[name] ?? defaults[name] ?? null]),
  )
