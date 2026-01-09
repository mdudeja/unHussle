export * from '@/types/Entity.type'
export * from '@/types/EntityCollection.type'
export * from '@/types/EntitySupporter.type'

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  MIGRATED = 'migrated',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum ProjectStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
  ON_HOLD = 'on_hold',
}
