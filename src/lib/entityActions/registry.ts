import { getResourceRoute } from '@/lib/entityRoutes'
import { Priority, ProgressStatus } from '@c/types/enums'
import { resolveTaskSchedule } from '@c/taskSchedule'
import { StoreState } from '@/store'
import {
  createAreaFields,
  createGoalFields,
  createProjectFields,
  createTagFields,
  createTaskFields,
  createResourceFields,
  createUrlFields,
  FieldConfig,
} from '@/components/ui/custom/entityForms'
import type { EntityKind } from './types'

// Records the field builders may offer as select options.
export type FieldSources = Record<
  'projects' | 'areas' | 'goals',
  { data: import('@c/types/readModels').EntityReference[] }
>

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
  createDefaults?: Record<string, unknown>
  createDescription: string
  createSubmitLabel?: string
  createdRoute?: (id: string) => string
  /** Derives values (e.g. a task's schedule) right before they are saved. */
  transformValues?: (values: Record<string, unknown>) => Record<string, unknown>
}

const statusDefaults = {
  status: ProgressStatus.PLANNED,
  priority: Priority.MEDIUM,
}

export const entityRegistry: Record<EntityKind, EntityRegistryEntry> = {
  tasks: {
    createDefaults: {
      ...statusDefaults,
      is_recurring: false,
      recurrance_rule: { type: 'daily', data: {} },
    },
    createDescription: 'Add a new task to your list.',
    label: 'task',
    selectSlice: (state) => state.tasks,
    createFields: ({ projects, areas, goals }) =>
      createTaskFields({
        projects: projects.data,
        areas: areas.data,
        goals: goals.data,
      }),
    // The recurrence editor needs a rule to start from (shared by creation and editing).
    formDefaults: {
      ...statusDefaults,
      recurrance_rule: { type: 'daily', data: {} },
    },
    transformValues: resolveTaskSchedule,
  },
  projects: {
    createDefaults: statusDefaults,
    createDescription: 'Add a new project to organise your tasks.',
    label: 'project',
    selectSlice: (state) => state.projects,
    createFields: ({ areas, goals }) =>
      createProjectFields({ areas: areas.data, goals: goals.data }),
    formDefaults: statusDefaults,
  },
  areas: {
    createDefaults: { priority: Priority.MEDIUM },
    createDescription: 'Add a new area to align tasks against.',
    label: 'area',
    selectSlice: (state) => state.areas,
    createFields: () => createAreaFields(),
    formDefaults: statusDefaults,
  },
  goals: {
    createDefaults: statusDefaults,
    createDescription: 'Add a new goal to align tasks against.',
    label: 'goal',
    selectSlice: (state) => state.goals,
    createFields: ({ areas }) => createGoalFields({ areas: areas.data }),
    formDefaults: statusDefaults,
  },
  tags: {
    createDescription: 'Add a new tag to label your tasks.',
    label: 'tag',
    selectSlice: (state) => state.tags,
    createFields: () => createTagFields(),
  },
  urls: {
    createDescription: 'Save a link to reference from your tasks.',
    createSubmitLabel: 'Save URL',
    label: 'URL',
    selectSlice: (state) => state.urls,
    createFields: () => createUrlFields(),
  },
  resources: {
    createDescription: 'A markdown note saved in your vault.',
    createSubmitLabel: 'Create and open',
    createdRoute: getResourceRoute,
    label: 'resource',
    selectSlice: (state) => state.resources,
    createFields: () => createResourceFields(),
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
