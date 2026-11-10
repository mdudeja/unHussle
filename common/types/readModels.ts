import type { Area, Goal, Project, Tag, Task, TimeEntry } from '@c/types'
import type { Url } from '@d/database/schemas/urls.schema'
import type {
  HydratedProject,
  HydratedArea,
  HydratedGoal,
  HydratedResource,
} from './Hydrated'

/** Labels for selectors and badges, independent of loaded entity lists. */
export type EntityReference = {
  id: string
  title: string
  icon?: string | null
  color?: string | null
  tags?: Pick<Tag['Read'], 'id' | 'title'>[]
}
/** Task table projection: labels, direct tags and open timer intervals only. */
export type TaskListItem = Task['Read'] & {
  project?: EntityReference | null
  area?: EntityReference | null
  goal?: EntityReference | null
  tags?: Tag['Read'][]
  timeEntries?: TimeEntry['Read'][]
}
export type ReadContainerKind = 'projects' | 'areas' | 'goals' | 'tags' | 'urls'
export type TaskPageOptions = {
  // base64-encoded JSON string of [scope, last.value, last.id]
  cursor?: string
  limit?: number
  q?: string
  status?: string
  priority?: string
  sort?: string
  direction?: string
  is_fun?: string
  is_chore?: string
  is_quick?: string
}
export type ReadPage<T> = {
  items: T[]
  total: number
  nextCursor: string | null
}
export type ContainerDetail = {
  item:
    Project['Read'] | Area['Read'] | Goal['Read'] | Tag['Read'] | Url['Read']
  /** Only direct, editable attachments. Membership is exclusively in tasks. */
  directRelations: {
    projects: HydratedProject[]
    areas: HydratedArea[]
    goals: HydratedGoal[]
    resources: HydratedResource[]
    tags: Tag['Read'][]
    urls: Url['Read'][]
  }
  tasks: ReadPage<TaskListItem>
}
