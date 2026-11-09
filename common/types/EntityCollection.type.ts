import type { Priority, ProgressStatus } from '@c/types/enums'

export { type Goal } from '@d/database/schemas/goals.schema'
export { type Area } from '@d/database/schemas/areas.schema'
export { type Project } from '@d/database/schemas/projects.schema'

export interface EntityCollection {
  id: string
  title: string
  status: ProgressStatus
  priority: Priority
  icon?: string
  color?: string
  description?: string
  created_at: number // timestamp
  updated_at: number // timestamp
}
