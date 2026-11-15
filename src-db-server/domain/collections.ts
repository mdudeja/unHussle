import { eq, isNotNull, sql } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { SyncTx } from '@d/database/repositories/helpers'
import type { ScheduleTx } from '@d/database/repositories/scheduler'
import type {
  EntityCollectionKind,
  EntryKind,
  MutationInput,
} from '@c/workflows/contracts'
import type { PublicationContext } from '@d/workflows/contracts'
import * as tables from '@d/database/schemas'
import { ProgressStatus } from '@c/types'

/**
 * Rows that belong to each collection kind, with the foreign key pointing at
 * it. All of these are `onDelete: 'set null'`, so deleting a collection
 * changes its members.
 */
const collectionMembers = {
  projects: [
    { kind: 'tasks', id: tables.tasks.id, fk: tables.tasks.project_id },
  ],
  areas: [
    { kind: 'tasks', id: tables.tasks.id, fk: tables.tasks.area_id },
    { kind: 'projects', id: tables.projects.id, fk: tables.projects.area_id },
    { kind: 'goals', id: tables.goals.id, fk: tables.goals.area_id },
  ],
  goals: [
    { kind: 'tasks', id: tables.tasks.id, fk: tables.tasks.goal_id },
    { kind: 'projects', id: tables.projects.id, fk: tables.projects.goal_id },
  ],
} as const satisfies {
  [K in EntityCollectionKind]: readonly {
    kind: EntryKind
    id: SQLiteColumn
    fk: SQLiteColumn
  }[]
}

/** Run before deletion: foreign keys are set null by SQLite afterwards. */
export function announceCollectionMembers(
  tx: SyncTx,
  { kind, action, id }: MutationInput,
  { operationId, announce }: PublicationContext,
) {
  if (!(kind in collectionMembers))
    throw new Error(
      `announceAffectedEntities is only supported for collections, got ${kind}`,
    )
  if (action !== 'deleteAll' && !id)
    throw new Error(
      'An entity id is required for announceAffectedEntities action',
    )
  for (const member of collectionMembers[kind as EntityCollectionKind]) {
    const attachedIds = tx
      .select({ id: member.id })
      .from(member.fk.table)
      .where(
        id && action !== 'deleteAll' ? eq(member.fk, id) : isNotNull(member.fk),
      )
      .all()
      .map((row) => row.id)
    if (attachedIds.length)
      announce(`${member.kind}.change`, {
        kind: member.kind,
        action: 'update',
        attachedIds,
        operationId,
        result: undefined,
      })
  }
}

export function updateGoalProjectStatus(
  tx: SyncTx,
  { kind, action, id, changes }: MutationInput,
  publication: PublicationContext,
) {
  if (
    kind !== 'tasks' ||
    !id ||
    !changes ||
    !['create', 'update'].includes(action)
  )
    return
  if (changes.status !== ProgressStatus.IN_PROGRESS) return
  startTaskCollections(tx, id, publication)
}

/** Planned or paused: started work moves these to in progress. */
const notStarted = (status: ProgressStatus | null) =>
  status === ProgressStatus.PLANNED || status === ProgressStatus.PAUSED

/**
 * Work started on a task moves its project and goal, and that project's
 * goal, to in progress while they haven't started. Finished ones stay so.
 */
export function startTaskCollections(
  tx: ScheduleTx,
  taskId: string,
  { operationId, announce }: PublicationContext,
) {
  const task = tx
    .select({
      project_id: tables.tasks.project_id,
      goal_id: tables.tasks.goal_id,
    })
    .from(tables.tasks)
    .where(eq(tables.tasks.id, taskId))
    .get()
  if (!task) return
  const project = task.project_id
    ? tx
        .select({
          status: tables.projects.status,
          goal_id: tables.projects.goal_id,
        })
        .from(tables.projects)
        .where(eq(tables.projects.id, task.project_id))
        .get()
    : undefined
  const goalIds = [...new Set([task.goal_id, project?.goal_id])].filter(
    (goalId): goalId is string => Boolean(goalId),
  )

  const start = (collection: 'projects' | 'goals', id: string) => {
    const table = tables[collection]
    const row = tx
      .select({ status: table.status })
      .from(table)
      .where(eq(table.id, id))
      .get()
    if (!row || !notStarted(row.status)) return
    tx.update(table)
      .set({ status: ProgressStatus.IN_PROGRESS })
      .where(eq(table.id, id))
      .run()
    const event = {
      kind: collection,
      operationId,
      id,
      action: 'update' as const,
      changes: { status: ProgressStatus.IN_PROGRESS },
      result: undefined,
    }
    announce(`${collection}.change`, event)
    announce('entityCollection.change', event)
  }
  if (task.project_id) start('projects', task.project_id)
  for (const goalId of goalIds) start('goals', goalId)
}

/**
 * Starting an occurrence starts its recurring task, once, and so its
 * collections. Ending an occurrence leaves the task as it is.
 */
export function startRecurringTask(
  tx: ScheduleTx,
  taskId: string,
  publication: PublicationContext,
  at: number,
) {
  const task = tx
    .select({ status: tables.tasks.status })
    .from(tables.tasks)
    .where(eq(tables.tasks.id, taskId))
    .get()
  if (!task || !notStarted(task.status)) return
  tx.update(tables.tasks)
    .set({
      status: ProgressStatus.IN_PROGRESS,
      started_at: sql`coalesce(${tables.tasks.started_at}, ${at})`,
    })
    .where(eq(tables.tasks.id, taskId))
    .run()
  publication.announce('tasks.change', {
    kind: 'tasks',
    action: 'update',
    attachedIds: [taskId],
    operationId: publication.operationId,
    result: undefined,
  })
  startTaskCollections(tx, taskId, publication)
}

export function updateGoalProjectCompletionData(
  tx: SyncTx,
  { kind, action, id, changes }: MutationInput,
  { operationId, announce }: PublicationContext,
) {
  if (
    !['goals', 'projects'].includes(kind) ||
    !id ||
    !action ||
    action !== 'update'
  )
    return
  if (
    !changes ||
    !changes.status ||
    changes.status !== ProgressStatus.COMPLETED
  )
    return

  // Spent time is counted live as work closes; completing only dates it.
  const table = tables[kind as 'goals' | 'projects']
  const completed_at = Date.now()
  tx.update(table).set({ completed_at }).where(eq(table.id, id)).run()
  const actionName = `${kind}.change` as const

  announce(actionName, {
    kind,
    operationId,
    action: 'update',
    id,
    changes: { completed_at },
    result: undefined,
  })

  announce('entityCollection.change', {
    kind,
    operationId,
    action: 'update',
    id,
    changes: { completed_at },
    result: undefined,
  })
}
