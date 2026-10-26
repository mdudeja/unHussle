import { TasksService } from '@/services/database/TasksService'
import { ProjectsService } from '@/services/database/ProjectsService'
import { AreasService } from '@/services/database/AreasService'
import { GoalsService } from '@/services/database/GoalsService'
import { ResourcesService } from '@/services/database/ResourcesService'
import { TagsService } from '@/services/database/TagsService'
import { UrlsService } from '@/services/database/UrlsService'
import { TimeEntriesService } from '@/services/database/TimeEntriesService'

export const entityServices = {
  tasks: TasksService.getInstance(),
  projects: ProjectsService.getInstance(),
  areas: AreasService.getInstance(),
  goals: GoalsService.getInstance(),
  resources: ResourcesService.getInstance(),
  tags: TagsService.getInstance(),
  urls: UrlsService.getInstance(),
  time_entries: TimeEntriesService.getInstance(),
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
