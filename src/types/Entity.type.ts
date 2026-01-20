import { Project, Area, Goal } from '@/types/EntityCollection.type'

export { type Task } from '@/services/database/schemas/tasks.schema'
export { type Resource } from '@/services/database/schemas/resources.schema'

export interface Entity {
  id: string
  title: string
  description?: string

  // Categorization
  project_id?: Project['Parent']['id']
  area_id?: Area['Parent']['id']
  goal_id?: Goal['Parent']['id']

  tag_ids: string[]
  url_ids: string[]

  created_at: number
  updated_at: number
}
