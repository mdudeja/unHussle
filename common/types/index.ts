import { AnySQLiteTable } from 'drizzle-orm/sqlite-core'

export enum ProgressStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  MIGRATED = 'migrated',
  ARCHIVED = 'archived',
  PAUSED = 'paused',
  ON_HOLD = 'on_hold',
  CANCELLED = 'cancelled',
}

export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum AnchorType {
  before = 'before',
  after = 'after',
  any_before = 'any_before',
  any_after = 'any_after',
}

export type InferTableTypes<B, T extends AnySQLiteTable> = {
  Parent: B
  Read: T['$inferSelect']
  Write: T['$inferInsert']
  Update: Partial<T['$inferInsert']>
}

/** Structural constraint satisfied by any `InferTableTypes` of an entity table */
export type DbEntityTypes = {
  Parent: unknown
  Read: { id: string }
  Write: object
  Update: object
}

export * from '@c/types/Entity.type'
export * from '@c/types/EntityCollection.type'
export * from '@c/types/EntitySupporter.type'
export * from '@c/types/JunctionTable.type'
export * from '@c/types/WithSupporters.type'
export type { TaskOccurrence } from '@d/database/schemas/scheduler.occurrences.schema'
export type { SchedulerDayPlan } from '@d/database/schemas/scheduler.dayplans.schema'
export type { SchedulerPlanItem } from '@d/database/schemas/scheduler.planItems.schema'
