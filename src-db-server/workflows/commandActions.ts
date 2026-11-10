import type { Logger } from '@c/Logger'
import type { MutationInput, MutationResult } from '@c/workflows/contracts'
import type {
  ActionContext,
  CommandAction,
  TransactionContext,
  TransactionWorkUnit,
} from './contracts'
import type { Vault } from '@d/vault/vault'
import { getNowMillis } from '@c/datetimeUtils'
import { markPlansStale } from '@d/database/repositories/scheduler'
import {
  createEntry,
  updateEntry,
  deleteEntry,
  deleteAllEntries,
} from '@d/domain/entries'
import { validateTask, trackTaskTransition } from '@d/domain/tasks'
import { announceCollectionMembers } from '@d/domain/collections'
import {
  updateSupporters,
  deleteSupporterJunctions,
} from '@d/domain/supporters'
import {
  updateResourceLinks,
  announceResourceLinks,
} from '@d/domain/resourceLinks'
import {
  recomputeCollectionCounts,
  recomputeSupporterCounts,
} from '@d/domain/counts'
import { syncResourceFile, trashResourceFiles } from '@d/domain/resourceFiles'
import {
  affectsSchedules,
  syncPlanMembership,
} from '@d/domain/scheduleMaintenance'

export type CommandActionHandler<Context> = (
  name: string,
  input: MutationInput,
  context: ActionContext<Context>,
) => TransactionWorkUnit<MutationResult>

/** Execution adapters only; integrity behavior lives in synchronous domain services. */
export function createCommandActions<
  Context extends { logger: Logger; now?: () => number; vault: Vault },
>() {
  type ContextWithEffects = ActionContext<Context>
  /** Creates a command action handler that executes the provided mutation logic within a transaction-aware context. */
  const action =
    (
      run: (
        work: TransactionContext,
        input: MutationInput,
        context: ContextWithEffects,
      ) => MutationResult,
    ): CommandActionHandler<Context> =>
    (name, input, context) => {
      context.logger.debug(
        `Executing action: ${name} for input: ${JSON.stringify(input)}`,
      )
      return (work) => run(work, input, context)
    }

  /** Ensures a mutation input includes an entity id and rejects the operation if it is missing. */
  const requireId = (input: MutationInput) => {
    if (!input.id) throw new Error('An entity id is required')
    return input.id
  }

  return {
    createRow: action((work, { kind, changes = {} }) =>
      createEntry(work, kind, changes),
    ),
    updateRow: action((work, input) =>
      updateEntry(work, input.kind, requireId(input), input.changes ?? {}),
    ),
    deleteRow: action((work, input) =>
      deleteEntry(work, input.kind, requireId(input)),
    ),
    deleteAllRows: action((work, { kind }) => deleteAllEntries(work, kind)),
    validateTask: action(({ tx }, input) => validateTask(tx, input)),
    trackTaskInterval: action(({ tx }, input, context) =>
      trackTaskTransition(tx, input, (context.now ?? getNowMillis)(), context),
    ),
    updateSupporters: action(({ tx }, input) => updateSupporters(tx, input)),
    deleteJunctions: action(({ tx }, input) =>
      deleteSupporterJunctions(tx, input),
    ),
    updateSupporterCounts: action(({ tx }) => recomputeSupporterCounts(tx)),
    updateCollectionCounts: action(({ tx }) => recomputeCollectionCounts(tx)),
    updateResourceLinks: action(({ tx }, input, context) =>
      updateResourceLinks(tx, input, context),
    ),
    announceResourceLinks: action(({ tx }, input, context) =>
      announceResourceLinks(tx, input, context),
    ),
    announceAffectedEntities: action(({ tx }, input, context) =>
      announceCollectionMembers(tx, input, context),
    ),
    syncResourceFile: action(({ tx }, input, context) =>
      syncResourceFile(tx, input, {
        ...context,
        now: context.now ?? getNowMillis,
      }),
    ),
    trashResourceFiles: action(({ tx }, input, context) =>
      trashResourceFiles(tx, input, {
        ...context,
        now: context.now ?? getNowMillis,
      }),
    ),
    markPlansStale: action(({ tx }, input, context) => {
      if (affectsSchedules(input))
        markPlansStale(tx, (context.now ?? getNowMillis)())
    }),
    syncPlanMembership: action(({ tx }, input) =>
      syncPlanMembership(tx, input),
    ),
  } satisfies Partial<Record<CommandAction, CommandActionHandler<Context>>>
}
