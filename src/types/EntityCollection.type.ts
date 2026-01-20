import { Priority, ProgressStatus } from '@/types/index'

export { type Goal } from '@/services/database/schemas/goals.schema'
export { type Area } from '@/services/database/schemas/areas.schema'
export { type Project } from '@/services/database/schemas/projects.schema'

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
