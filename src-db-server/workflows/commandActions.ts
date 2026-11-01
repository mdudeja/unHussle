import {
  markPlansStale,
  validateTaskAnchors,
} from '@d/database/repositories/scheduler'
import { validateRecurrence } from '@c/scheduler/validation'
import { validateTaskSchedule } from '@c/taskSchedule'
import { getNowMillis } from '@c/datetimeUtils'
import { eq, isNotNull, sql } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import { Logger } from '@c/Logger'
import {
  ActionContext,
  CommandAction,
  EntityCollectionKind,
  EntitySupporterKind,
  EntryKind,
  EntryRecord,
  MutationInput,
  MutationResult,
  TransactionWorkUnit,
} from '@c/workflows/contracts'
import { Handler } from '@c/workflows/runtime'
import {
  normalizeTagTitle,
  removeEntityOwnedSupporterJunctions,
  removeReferenceSupporterJunctions,
  supporterCapabilities,
  syncSupporters,
} from '@d/workflows/supporters'
import { TagInput, TimeEntryInput, UrlInput } from '@c/types'
import { toUrlParts } from '@d/database/repositories/helpers'
import * as tables from '@d/database/schemas'
import { TableWithId } from '@d/database/repositories/BaseRepository'
import {
  recomputeCollectionCounts,
  recomputeSupporterCounts,
} from '@d/workflows/counts'
import { trackInterval } from '@d/workflows/tracking'
import {
  affectsSchedules,
  syncPlanMembership,
} from '@d/workflows/scheduleMaintenance'

const entityTables: { [K in EntryKind]: TableWithId } = {
  tasks: tables.tasks,
  projects: tables.projects,
  areas: tables.areas,
  goals: tables.goals,
  resources: tables.resources,
  tags: tables.tags,
  urls: tables.urls,
  time_entries: tables.timeEntries,
}

/**
 * Rows that belong to each collection kind, with the foreign key pointing at
 * it. All of these are `onDelete: 'set null'`, so deleting a collection
 * changes its members.
 */
const collectionMembers = {
  projects: [
    { kind: 'tasks', id: tables.tasks.id, fk: tables.tasks.project_id },
    {
      kind: 'resources',
      id: tables.resources.id,
      fk: tables.resources.project_id,
    },
  ],
  areas: [
    { kind: 'tasks', id: tables.tasks.id, fk: tables.tasks.area_id },
    {
      kind: 'resources',
      id: tables.resources.id,
      fk: tables.resources.area_id,
    },
    { kind: 'projects', id: tables.projects.id, fk: tables.projects.area_id },
    { kind: 'goals', id: tables.goals.id, fk: tables.goals.area_id },
  ],
  goals: [
    { kind: 'tasks', id: tables.tasks.id, fk: tables.tasks.goal_id },
    {
      kind: 'resources',
      id: tables.resources.id,
      fk: tables.resources.goal_id,
    },
    { kind: 'projects', id: tables.projects.id, fk: tables.projects.goal_id },
  ],
} as const satisfies {
  [K in EntityCollectionKind]: readonly {
    kind: EntryKind
    id: SQLiteColumn
    fk: SQLiteColumn
  }[]
}

export type CommandActionHandler<Context> = Handler<
  MutationInput,
  TransactionWorkUnit<MutationResult>,
  ActionContext<Context>
>

/**
 * Strips supporter keys and derived count columns, and applies per-kind
 * normalization to row values.
 */
function toRowValues(kind: EntryKind, changes: Record<string, unknown>) {
  const {
    tags: _tags,
    urls: _urls,
    time_entries: _time_entries,
    count_tasks: _count_tasks,
    count_resources: _count_resources,
    count_pga: _count_pga,
    ...values
  } = changes

  // Status transitions are tracked here, so their time totals are backend-owned.
  if (kind === 'tasks' && 'status' in values) {
    delete values.spent_minutes
    delete values.started_at
    delete values.completed_at
  }

  if (kind === 'urls' && typeof values.url === 'string') {
    values.parts = toUrlParts(values.url)
  }

  if (kind === 'tags' && typeof values.title === 'string') {
    values.title = normalizeTagTitle(values.title)
  }

  return values
}

export function createCommandActions<
  Context extends { logger: Logger; now?: () => number },
>() {
  const actions: {
    [K in CommandAction]?: CommandActionHandler<Context>
  } = {
    createRow: (eventName, input, { logger }) => {
      logger.debug(
        `Executing action: ${eventName} for input: ${JSON.stringify(input)}`,
      )
      const { kind, changes = {} } = input
      const values = toRowValues(kind, changes)

      return ({ repository }) => {
        const row = repository(entityTables[kind]).insert(values)
        if (!row) throw new Error(`Failed to insert ${kind}`)
        return row as EntryRecord
      }
    },

    updateRow: (eventName, input, { logger }) => {
      logger.debug(
        `Executing action: ${eventName} for input: ${JSON.stringify(input)}`,
      )
      const { id, kind, changes = {} } = input
      if (!id) {
        throw new Error('An entity id is required for updateRow action')
      }
      const values = toRowValues(kind, changes)

      return ({ repository }) => {
        const row = repository(entityTables[kind]).update(id, values)
        if (!row) throw new Error('NOT_FOUND')
        return row as EntryRecord
      }
    },

    // Runs after the write, so it validates the row as stored.
    validateTask: (_name, { kind, id }) => {
      return ({ tx }) => {
        if (kind !== 'tasks' || !id) return
        const task = tx
          .select()
          .from(tables.tasks)
          .where(eq(tables.tasks.id, id))
          .get()
        if (!task) return
        validateRecurrence(task)
        const error = validateTaskSchedule(task)
        if (error) throw new Error(error)
        validateTaskAnchors(tx, task)
      }
    },

    // Status transitions open/close tracking intervals and stamp lifecycle times.
    trackTaskInterval: (_name, { kind, id, changes }, { now = getNowMillis }) => {
      const status = changes?.status
      return ({ tx }) => {
        if (kind !== 'tasks' || !id || typeof status !== 'string') return
        const at = now()
        trackInterval(tx, id, null, status, at)
        if (status === 'in_progress')
          tx.update(tables.tasks)
            .set({ started_at: sql`coalesce(${tables.tasks.started_at}, ${at})` })
            .where(eq(tables.tasks.id, id))
            .run()
        if (status === 'completed')
          tx.update(tables.tasks)
            .set({ completed_at: at })
            .where(eq(tables.tasks.id, id))
            .run()
      }
    },

    markPlansStale: (_name, input, { now = getNowMillis }) => {
      return ({ tx }) => {
        if (affectsSchedules(input)) markPlansStale(tx, now())
      }
    },

    syncPlanMembership: (_name, input) => {
      return ({ tx }) => {
        syncPlanMembership(tx, input)
      }
    },

    deleteRow: (eventName, input, { logger }) => {
      logger.debug(
        `Executing action: ${eventName} for input: ${JSON.stringify(input)}`,
      )
      const { id, kind } = input
      if (!id) {
        throw new Error('An entity id is required for deleteRow action')
      }

      return ({ repository }) => {
        const row = repository(entityTables[kind]).delete(id)
        if (!row) throw new Error('NOT_FOUND')
        return row as EntryRecord
      }
    },

    deleteAllRows: (eventName, input, { logger }) => {
      logger.debug(
        `Executing action: ${eventName} for input: ${JSON.stringify(input)}`,
      )
      const { kind } = input

      return ({ repository }) =>
        repository(entityTables[kind]).deleteAll() as EntryRecord[]
    },

    updateSupporters: (eventName, input, { logger }) => {
      logger.debug(
        `Executing action: ${eventName} for input: ${JSON.stringify(input)}`,
      )
      if (!input || !input.kind || !input.action || !input.id) {
        throw new Error('Invalid input for updateSupporters action')
      }

      const { kind, action, id, changes = {} } = input
      const { tags, urls, time_entries } = changes
      const capability = supporterCapabilities[kind]

      if (
        (tags !== undefined && !capability?.tags) ||
        (urls !== undefined && !capability?.urls) ||
        (time_entries !== undefined && !capability?.time_entries)
      ) {
        throw new Error(`Provided Supporters are not supported for ${kind}`)
      }

      return ({ tx }) => {
        if (!capability) return
        syncSupporters(
          tx,
          id,
          {
            tags: tags as TagInput[] | undefined,
            urls: urls as UrlInput[] | undefined,
            time_entries: time_entries as TimeEntryInput[] | undefined,
          },
          { replace: action === 'update' },
        )
      }
    },

    deleteJunctions: (eventName, input, { logger }) => {
      logger.debug(
        `Executing action: ${eventName} for input: ${JSON.stringify(input)}`,
      )

      if (!input || (!input.ids && !input.attachedIds)) {
        throw new Error('Invalid input for deleteJunctions action')
      }

      if (input.ids && !Array.isArray(input.ids)) {
        throw new Error('Input ids must be an array for deleteJunctions action')
      }

      if (input.attachedIds && !Array.isArray(input.attachedIds)) {
        throw new Error(
          'Input attachedIds must be an array for deleteJunctions action',
        )
      }

      // `attachedIds` match junction `attachedToId` (owning entities / collections);
      // `ids` match junction `refId` (supporters of `input.kind`).
      return ({ tx }) => {
        if (input.attachedIds) {
          removeEntityOwnedSupporterJunctions(tx, input.attachedIds)
        }

        if (input.ids) {
          removeReferenceSupporterJunctions(
            tx,
            input.kind as EntitySupporterKind,
            input.ids,
          )
        }
      }
    },

    updateSupporterCounts: (eventName, input, { logger }) => {
      logger.debug(
        `Executing action: ${eventName} for input: ${JSON.stringify(input)}`,
      )

      return ({ tx }) => {
        recomputeSupporterCounts(tx)
      }
    },

    updateCollectionCounts: (eventName, input, { logger }) => {
      logger.debug(
        `Executing action: ${eventName} for input: ${JSON.stringify(input)}`,
      )

      return ({ tx }) => {
        recomputeCollectionCounts(tx)
      }
    },

    // Must run before the collection row is deleted: the entity foreign keys
    // are set to null on delete, after which the members can't be found.
    announceAffectedEntities: (
      eventName,
      input,
      { logger, operationId, announce },
    ) => {
      logger.debug(
        `Executing action: ${eventName} for input: ${JSON.stringify(input)}`,
      )
      const { kind, action, id } = input
      if (!(kind in collectionMembers)) {
        throw new Error(
          `announceAffectedEntities is only supported for collections, got ${kind}`,
        )
      }
      if (action !== 'deleteAll' && !id) {
        throw new Error(
          'An entity id is required for announceAffectedEntities action',
        )
      }
      const members = collectionMembers[kind as EntityCollectionKind]

      return ({ tx }) => {
        for (const member of members) {
          const attachedIds = tx
            .select({ id: member.id })
            .from(member.fk.table)
            .where(
              id && action !== 'deleteAll'
                ? eq(member.fk, id)
                : isNotNull(member.fk),
            )
            .all()
            .map((row) => row.id)

          if (attachedIds.length === 0) continue

          announce(`${member.kind}.change`, {
            kind: member.kind,
            action: 'update',
            attachedIds,
            operationId,
            result: undefined,
          })
        }
      }
    },
  }

  return actions
}
