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
  project?: Project['Read'] | null
  area?: Area['Read'] | null
  goal?: Goal['Read'] | null
  anchor?: Task['Read'] | null
  tags?: Tag['Read'][]
  urls?: Url['Read'][]
  timeEntries?: TimeEntry['Read'][]
}

export type HydratedTask = Task['Read'] & TaskRelations

type ProjectRelations = {
  area?: Area['Read'] | null
  goal?: Goal['Read'] | null
  tasks?: Task['Read'][]
  resources?: Resource['Read'][]
  tags?: Tag['Read'][]
  urls?: Url['Read'][]
}

export type HydratedProject = Project['Read'] & ProjectRelations

type AreaRelations = {
  tasks?: Task['Read'][]
  resources?: Resource['Read'][]
  projects?: Project['Read'][]
  tags?: Tag['Read'][]
  urls?: Url['Read'][]
}

export type HydratedArea = Area['Read'] & AreaRelations

type GoalRelations = {
  area?: Area['Read'] | null
  tasks?: Task['Read'][]
  resources?: Resource['Read'][]
  projects?: Project['Read'][]
  tags?: Tag['Read'][]
  urls?: Url['Read'][]
}

export type HydratedGoal = Goal['Read'] & GoalRelations

type ResourceRelations = {
  project?: Project['Read'] | null
  area?: Area['Read'] | null
  goal?: Goal['Read'] | null
  tags?: Tag['Read'][]
  urls?: Url['Read'][]
}

export type HydratedResource = Resource['Read'] & ResourceRelations
