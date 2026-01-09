import { ProjectStatus } from '@/types/index'

export interface EntityCollection {
  id: string
  title: string
  icon?: string
  color?: string
  description?: string
  created_at: number // timestamp
  updated_at: number // timestamp
}

export interface Goal extends EntityCollection {
  target_date?: number // timestamp
  progress: number // 0-100
}

export interface Area extends EntityCollection {}

export interface Project extends EntityCollection {
  area_id?: string
  goal_id?: string
  status: ProjectStatus
  deadline?: number // timestamp
}
