import { eq, isNotNull } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { SyncTx } from '@d/database/repositories/helpers'
import type {
  EntityCollectionKind,
  EntryKind,
  MutationInput,
} from '@c/workflows/contracts'
import type { PublicationContext } from '@d/workflows/contracts'
import * as tables from '@d/database/schemas'

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
