import { EntityUrl, Tag } from '@/types/EntitySupporter.type'
import { Project, Area, Goal } from '@/types/EntityCollection.type'
import { TaskPriority, TaskStatus } from '@/types/index'

export interface Entity {
  id: string
  title: string
  description?: string

  // Categorization
  project_id?: Project['id']
  area_id?: Area['id']
  goal_id?: Goal['id']

  created_at: number
  updated_at: number
}

export interface Task extends Entity {
  status: TaskStatus
  priority: TaskPriority

  // Time Management
  estimated_duration?: number // in minutes
  time_spent: number // in seconds
  due_date?: number // timestamp

  // Flags
  is_recurring: boolean
  recurring_rule?: string // rrule string or similar
  is_fun: boolean // For dopamine/fun tasks
  is_chore: boolean

  // Placement/Ordering
  stack_order: number // For manual ordering in stacks
  scheduled_for?: number // timestamp (date) for when this task is planned (Today view)

  completed_at?: number
}

export interface Resource extends Entity {}

export type EntityWithTags<T extends Entity> = T & {
  tags: Array<Tag>
}

export type EntityWithTagsAndUrls<T extends Entity> = EntityWithTags<T> & {
  urls: Array<EntityUrl>
}

export type TaskWithTagsAndUrls = EntityWithTagsAndUrls<Task>
export type ResourceWithTagsAndUrls = EntityWithTagsAndUrls<Resource>

export interface TimeEntry {
  id: string
  task_id: Task['id']
  start_time: number
  end_time?: number
  duration: number // milliseconds
}
