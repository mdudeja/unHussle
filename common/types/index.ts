import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'

export enum ProgressStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  MIGRATED = 'migrated',
  ARCHIVED = 'archived',
  PAUSED = 'paused',
  ON_HOLD = 'on_hold',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export type InferTableTypes<B, T extends SQLiteTableWithColumns<any>> = {
  Parent: B
  Read: T['$inferSelect']
  Write: T['$inferInsert']
  Update: Partial<T['$inferInsert']>
}

export * from '@c/types/Entity.type'
export * from '@c/types/EntityCollection.type'
export * from '@c/types/EntitySupporter.type'
export * from '@c/types/JunctionTable.type'
