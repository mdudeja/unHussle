import type { AnySQLiteTable } from 'drizzle-orm/sqlite-core'

export { ProgressStatus, Priority, AnchorType } from './enums'

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

export type * from '@c/types/Entity.type'
export type * from '@c/types/EntityCollection.type'
export type * from '@c/types/EntitySupporter.type'
export type * from '@c/types/JunctionTable.type'
export type * from '@c/types/WithSupporters.type'
export type { TaskOccurrence } from '@d/database/schemas/scheduler.occurrences.schema'
export type { SchedulerDayPlan } from '@d/database/schemas/scheduler.dayplans.schema'
export type { SchedulerPlanItem } from '@d/database/schemas/scheduler.planItems.schema'
