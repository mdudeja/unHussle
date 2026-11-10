import { fetchSupporterItems } from '@/services/readModels'
import type {
  HydratedTask,
  HydratedProject,
  HydratedArea,
  HydratedGoal,
  HydratedResource,
} from '@c/types/Hydrated'
import { createDbService } from '@/services/database/DbService'
import type {
  Task,
  Project,
  Area,
  Goal,
  Resource,
  Tag,
  EntityUrl,
  TimeEntry,
} from '@c/types'

export const entityServices = {
  tasks: createDbService<Task, HydratedTask>('tasks'),
  projects: createDbService<Project, HydratedProject>('projects'),
  areas: createDbService<Area, HydratedArea>('areas'),
  goals: createDbService<Goal, HydratedGoal>('goals'),
  resources: createDbService<Resource, HydratedResource>('resources'),
  tags: {
    ...createDbService<Tag>('tags'),
    fetchItems: (id: string) => fetchSupporterItems('tags', id),
  },
  urls: {
    ...createDbService<EntityUrl>('urls'),
    fetchItems: (id: string) => fetchSupporterItems('urls', id),
  },
  time_entries: createDbService<TimeEntry>('time_entries'),
}
export const fetchLimits: Record<keyof typeof entityServices, number> = {
  areas: +(import.meta.env.VITE_FETCH_LIMIT_AREAS || '50'),
  goals: +(import.meta.env.VITE_FETCH_LIMIT_GOALS || '30'),
  projects: +(import.meta.env.VITE_FETCH_LIMIT_PROJECTS || '30'),
  resources: +(import.meta.env.VITE_FETCH_LIMIT_RESOURCES || '100'),
  tags: +(import.meta.env.VITE_FETCH_LIMIT_TAGS || '100'),
  tasks: +(import.meta.env.VITE_FETCH_LIMIT_TASKS || '100'),
  time_entries: +(import.meta.env.VITE_FETCH_LIMIT_TIME_ENTRIES || '100'),
  urls: +(import.meta.env.VITE_FETCH_LIMIT_URLS || '100'),
}

export type EntityRead<K extends keyof typeof entityServices> = Awaited<
  ReturnType<(typeof entityServices)[K]['fetchById']>
>
