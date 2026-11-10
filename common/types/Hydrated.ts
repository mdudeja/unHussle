import type { EntityReference } from './readModels'
import type { Url } from '@d/database/schemas/urls.schema'
import type {
  Task,
  Project,
  Area,
  Goal,
  Resource,
  Tag,
  TimeEntry,
} from '@c/types'

type TaskRelations = {
  project?: EntityReference | null
  area?: EntityReference | null
  goal?: EntityReference | null
  anchor?: EntityReference | null
  tags?: Tag['Read'][]
  urls?: Url['Read'][]
  timeEntries?: TimeEntry['Read'][]
  resources?: Resource['Read'][]
}

export type HydratedTask = Task['Read'] & TaskRelations

type ProjectRelations = {
  /** Resolved containment total; count_tasks remains the direct-assignment count. */
  resolved_task_total?: number
  area?: EntityReference | null
  goal?: EntityReference | null
  resources?: Resource['Read'][]
  tags?: Tag['Read'][]
  urls?: Url['Read'][]
}

export type HydratedProject = Project['Read'] & ProjectRelations

type AreaRelations = {
  /** Resolved containment total; count_tasks remains the direct-assignment count. */
  resolved_task_total?: number
  goals?: Goal['Read'][]
  resources?: Resource['Read'][]
  projects?: Project['Read'][]
  tags?: Tag['Read'][]
  urls?: Url['Read'][]
}

export type HydratedArea = Area['Read'] & AreaRelations

type GoalRelations = {
  /** Resolved containment total; count_tasks remains the direct-assignment count. */
  resolved_task_total?: number
  area?: EntityReference | null
  resources?: Resource['Read'][]
  projects?: Project['Read'][]
  tags?: Tag['Read'][]
  urls?: Url['Read'][]
}

export type HydratedGoal = Goal['Read'] & GoalRelations

/** Kinds a resource can be linked to through `junction_resources`. */
export type ResourceLinkKind = 'tasks' | 'projects' | 'areas' | 'goals'

/** A task or collection a resource is linked to. */
export type ResourceLink = { kind: ResourceLinkKind; id: string; title: string }

type ResourceRelations = {
  tags?: Tag['Read'][]
  urls?: Url['Read'][]
  links?: ResourceLink[]
  /** The resource's file is not in the vault. */
  missing?: boolean
}

export type HydratedResource = Resource['Read'] & ResourceRelations

/** Resources, links and tags attached to one owner. */
export type ContextItems = {
  resources: Resource['Read'][]
  urls: Url['Read'][]
  tags: Tag['Read'][]
}

/** Items a task inherits from one ancestor collection. */
export type ContextGroup = ContextItems & {
  source: { kind: 'projects' | 'areas' | 'goals'; id: string; title: string }
}

/** A task's own items, plus those it inherits from its ancestors. */
export type TaskContext = {
  taskId: string
  own: ContextItems
  inherited: ContextGroup[]
}
