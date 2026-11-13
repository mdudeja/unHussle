import { eq, isNotNull } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { SyncTx } from '@d/database/repositories/helpers'
import type {
  EntityCollectionKind,
  EntityKind,
  EntryKind,
  MutationInput,
} from '@c/workflows/contracts'
import type { PublicationContext } from '@d/workflows/contracts'
import * as tables from '@d/database/schemas'
import { ProgressStatus } from '@c/types'
import { taskMembershipPredicate } from '@d/database/repositories/taskMembership'

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
  { operationId, announce }: PublicationContext,
) {
  if (
    kind !== 'tasks' ||
    !id ||
    !changes ||
    !['create', 'update'].includes(action)
  )
    return
  if (!changes.status || changes.status !== ProgressStatus.IN_PROGRESS) return

  const task = tx
    .select()
    .from(tables.tasks)
    .where(eq(tables.tasks.id, id))
    .get()
  const { project_id, goal_id } = task ?? {}

  const collections = [
    { kind: 'projects', id: project_id },
    { kind: 'goals', id: goal_id },
  ]

  const getTable = (kind: 'goals' | 'projects') => tables[kind]

  collections.forEach(({ kind, id }) => {
    if (!id) return
    const collection = tx
      .select()
      .from(getTable(kind as 'goals' | 'projects'))
      .where(eq(getTable(kind as 'goals' | 'projects').id, id))
      .get()

    if (collection && collection.status !== ProgressStatus.IN_PROGRESS) {
      tx.update(getTable(kind as 'goals' | 'projects'))
        .set({ status: ProgressStatus.IN_PROGRESS })
        .where(eq(getTable(kind as 'goals' | 'projects').id, id))
        .run()

      if (kind === 'projects') {
        const project = tx
          .select()
          .from(tables.projects)
          .where(eq(tables.projects.id, id))
          .get()

        if (project && project.goal_id) {
          collections.push({ kind: 'goals', id: project.goal_id })
        }
      }

      const actionName = `${kind as EntityKind}.change` as const

      announce(actionName, {
        kind: kind as EntityKind,
        operationId,
        id,
        action: 'update',
        changes: { status: ProgressStatus.IN_PROGRESS },
        result: undefined,
      })

      announce('entityCollection.change', {
        kind: kind as EntityKind,
        action: 'update',
        id,
        operationId,
        changes: { status: ProgressStatus.IN_PROGRESS },
        result: undefined,
      })
    }
  })
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

  const getTable = (kind: 'goals' | 'projects') => tables[kind]
  const whereCondition = taskMembershipPredicate(tx, {
    kind: kind as EntityCollectionKind,
    id,
  })

  const tasks = tx
    .select({ time: tables.tasks.spent_minutes })
    .from(tables.tasks)
    .where(whereCondition)
    .all()
  const totalSpentMinutes = tasks.reduce(
    (sum, task) => sum + (task.time ?? 0),
    0,
  )

  tx.update(getTable(kind as 'goals' | 'projects'))
    .set({ completed_at: Date.now(), spent_minutes: totalSpentMinutes })
    .where(eq(getTable(kind as 'goals' | 'projects').id, id))
    .run()
  const actionName = `${kind}.change` as const

  announce(actionName, {
    kind,
    operationId,
    action: 'update',
    id,
    changes: { completed_at: Date.now(), spent_minutes: totalSpentMinutes },
    result: undefined,
  })

  announce('entityCollection.change', {
    kind,
    operationId,
    action: 'update',
    id,
    changes: { completed_at: Date.now(), spent_minutes: totalSpentMinutes },
    result: undefined,
  })
}
