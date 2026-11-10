import { Type } from '@sinclair/typebox'
import {
  createCompositionRegistry,
  executeWorkflow,
  type CommandDefinition,
} from '@c/workflows/composition'
import {
  mutationDefinition,
  mutationInputSchema,
  rowOutputSchema,
  rowOutput,
  createStateComposition,
} from './composition'
import { commandHeadForKind } from '@c/workflows/contracts'
import type {
  ActionContext,
  Announce,
  TransactionWorkUnit,
} from '@d/workflows/contracts'
import { createRuntime } from '@c/workflows/runtime'
import type {
  AppEvents,
  MutationCommands,
  MutationEvent,
  MutationInput,
  MutationResult,
  EntryRecord,
} from '@c/workflows/contracts'
import { Logger } from '@c/Logger'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { createUnitOfWork } from '@d/workflows/unitOfWork'
import { commandHandlerRegistry } from '@d/workflows/commandHandlers'
import { createCommandActions } from '@d/workflows/commandActions'
import { backendTelemetry } from '@d/workflows/telemetry'
import type { Telemetry } from '@c/workflows/telemetry'
import type { SpanScope } from '@c/workflows/telemetry'
import {
  schedulerCommandEvents,
  schedulerCommandNames,
  type SchedulerCommands,
} from '@c/scheduler/contracts'
import { getNowMillis } from '@c/datetimeUtils'
import { readSettings } from '@d/workflows/scheduler'
import {
  schedulerActions,
  type SchedulerState,
} from '@d/workflows/schedulerActions'
import { schedulerHandlerRegistry } from '@d/workflows/schedulerHandlers'
import {
  vaultCommandEvents,
  vaultCommandNames,
  type VaultCommands,
} from '@c/vault/contracts'
import { createVault, defaultVaultRoot } from '@d/vault/vault'
import { vaultActions } from '@d/workflows/vaultActions'
import type { VaultState } from './contracts'
import { vaultHandlerRegistry } from '@d/workflows/vaultHandlers'

/** Creates the backend runtime that provides the command, workflow, scheduling, and vault execution capabilities for the application. */
export function createBackendRuntime(
  database: UnHussleDB,
  {
    telemetry = backendTelemetry,
    now = getNowMillis,
    vaultDir,
  }: { telemetry?: Telemetry; now?: () => number; vaultDir?: string } = {},
) {
  const context = {
    now,
    unitOfWork: createUnitOfWork(database),
    logger: Logger.getInstance(),
    vault: createVault(vaultDir ?? defaultVaultRoot(database.filePath)),
  }
  const runtime = createRuntime<
    MutationCommands & SchedulerCommands & VaultCommands,
    AppEvents,
    typeof context
  >(context, { telemetry })
  const availableActions = createCommandActions<typeof context>()

  /** Side effects outside the database that a command registers as it goes. */
  const sideEffects = () => {
    const undos: (() => void)[] = []
    const afterCommits: (() => void | Promise<void>)[] = []
    return {
      undos,
      afterCommits,
      compensate: (undo: () => void) => {
        undos.push(undo)
      },
      afterCommit: (run: () => void | Promise<void>) => {
        afterCommits.push(run)
      },
    }
  }

  /**
   * Runs a compiled composition in one transaction. Failure rolls back SQLite
   * and compensates file changes newest first. Completion runs after publication.
   */
  const commit = async <T>(
    work: TransactionWorkUnit<T>,
    trace?: SpanScope,
    effects?: ReturnType<typeof sideEffects>,
  ) => {
    let result: T | undefined
    try {
      result = await context.unitOfWork.transaction(work)
    } catch (error) {
      for (const undo of [...(effects?.undos ?? [])].reverse()) {
        try {
          undo()
        } catch (undoError) {
          context.logger.error('Undoing a vault change failed', {
            error: undoError,
            traceId: trace?.traceId,
          })
        }
      }
      trace?.setAttrs({ rolledBack: true })
      throw error
    }
    return result
  }

  /** Executes post-commit cleanup effects, logging any failures so they do not interrupt the remaining cleanup. */
  const completeEffects = async (
    effects: ReturnType<typeof sideEffects>,
    trace?: SpanScope,
  ) => {
    for (const run of effects.afterCommits) {
      try {
        await run()
      } catch (error) {
        context.logger.error('Post-commit cleanup failed', {
          error,
          traceId: trace?.traceId,
        })
      }
    }
  }

  /** Actions run inside the synchronous SQLite transaction, so their spans are too. */
  const spanAction = <T>(
    trace: SpanScope | undefined,
    name: string,
    attrs: Record<string, string>,
    run: (span?: SpanScope) => T,
  ) =>
    trace
      ? telemetry.span('action', name, run, {
          traceId: trace.traceId,
          parentId: trace.spanId,
          attrs,
        })
      : run()

  const compositions = createCompositionRegistry<{
    transaction: Parameters<TransactionWorkUnit<unknown>>[0]
    actionContext: ActionContext<typeof context>
    trace?: SpanScope
  }>()
  const rowActions = new Set([
    'createRow',
    'updateRow',
    'deleteRow',
    'deleteAllRows',
  ])
  for (const [name, action] of Object.entries(availableActions)) {
    compositions.registerAction({
      id: `kernel.mutation.${name}`,
      description: name,
      input: mutationInputSchema,
      output: rowActions.has(name) ? rowOutputSchema : Type.Undefined(),
      /** Runs a synchronous mutation action within the provided transaction and trace context, returning its result in the expected output form. */
      run(value, { transaction, actionContext, trace }) {
        const input = value as MutationInput
        return spanAction(
          trace,
          name,
          { kind: input.kind, verb: input.action },
          () => {
            const unit = action(name, input, actionContext)
            if (unit instanceof Promise)
              throw new Error(`Action ${name} must be synchronous`)
            const result = unit(transaction)
            if (result instanceof Promise)
              throw new Error(`Action ${name} must be synchronous`)
            return rowActions.has(name) ? rowOutput(input, result) : result
          },
        )
      },
    })
  }
  for (const [name, actions] of Object.entries(commandHandlerRegistry)) {
    if (name.startsWith('entry.')) continue
    compositions.registerCommand(mutationDefinition(name, actions), {
      required: actions.map((action) => `kernel.mutation.${action}`),
      protectBindings: true,
    })
  }
  const schedulerCompositions = createStateComposition(
    schedulerHandlerRegistry,
    schedulerActions,
    'kernel.scheduler',
    (name, run, trace) => spanAction(trace, name, {}, run),
  )
  const vaultCompositions = createStateComposition(
    vaultHandlerRegistry,
    vaultActions,
    'kernel.vault',
    (name, run, trace) => spanAction(trace, name, {}, run),
  )

  /** Publishes after commit; a failing listener never fails the command. */
  const publishAll = async (
    events: Parameters<Announce>[],
    operationId: string,
    meta: { traceId?: string; parentId?: string },
  ) => {
    const outcomes = []
    for (const [name, payload] of events)
      outcomes.push(...(await runtime.events.publish(name, payload, meta)))
    for (const outcome of outcomes)
      if (outcome.status === 'rejected')
        context.logger.error(`Post-commit listener failed (${operationId})`, {
          error: outcome.reason,
          traceId: meta.traceId,
        })
  }

  for (const commandName in commandHandlerRegistry) {
    if (commandName.startsWith('entry.')) continue
    runtime.commands.handle(
      commandName as keyof MutationCommands,
      async (handlerName, input, context, trace) => {
        const { logger } = context
        const [head, requestedVerb] = handlerName.split('.')
        const expectedAction = {
          add: 'create',
          change: 'update',
          delete: 'delete',
          deleteAll: 'deleteAll',
        }[requestedVerb]
        if (
          head !== commandHeadForKind[input.kind] ||
          input.action !== expectedAction
        )
          throw new Error(
            `Command ${handlerName} does not accept ${input.kind}/${input.action}`,
          )
        // Payloads hold user data, so they are only logged at debug level.
        logger.debug(
          `Executing command: ${handlerName} for input: ${JSON.stringify(input)}`,
          { traceId: trace?.traceId },
        )
        const operationId =
          input.operationId ?? trace?.traceId ?? crypto.randomUUID()
        const verb = handlerName.slice(handlerName.indexOf('.') + 1)

        // Announcements are held until commit and dropped on rollback.
        const announcements: Parameters<Announce>[] = []
        const effects = sideEffects()
        const actionContext: ActionContext<typeof context> = {
          ...context,
          operationId,
          announce: (name, payload) => {
            announcements.push([name, payload])
          },
          compensate: effects.compensate,
          afterCommit: effects.afterCommit,
        }

        // Preparation finishes before this single atomic execution. The result
        // binding is explicit; all validation runs before SQLite can commit.
        const result = await commit<MutationResult>(
          (transaction) =>
            compositions.execute(handlerName, input, {
              transaction,
              actionContext,
              trace,
            }) as MutationResult,
          trace,
          effects,
        )

        // Publish under the command (`entity.add`) and its kind (`tasks.add`)
        // so listeners can subscribe to a whole family or a single kind.
        const event: MutationEvent = { ...input, operationId, result }
        const eventNames = new Set([handlerName, `${input.kind}.${verb}`])
        const meta = { traceId: trace?.traceId, parentId: trace?.spanId }
        trace?.setAttrs({
          kind: input.kind,
          operationId,
          announcements: announcements.length,
          events: [...announcements.map(([name]) => name), ...eventNames].join(
            ',',
          ),
        })

        await publishAll(
          [
            // Deliver dependent changes before the completion events the client
            // waits for, so it observes all atomically changed tasks on return.
            ...announcements,
            ...[...eventNames].map(
              (name) =>
                [name as keyof AppEvents, event] as Parameters<Announce>,
            ),
          ],
          operationId,
          meta,
        )

        await completeEffects(effects, trace)
        return result
      },
    )
  }

  // Scheduler commands run their registered actions over one carried state.
  for (const command of schedulerCommandNames)
    runtime.commands.handle(command, async (_name, input, _context, trace) => {
      const operationId =
        input.operationId ?? trace?.traceId ?? crypto.randomUUID()
      const announcements: Parameters<Announce>[] = []
      const result = await commit((transaction) => {
        const state = {
          command,
          input,
          now: now(),
          settings: readSettings(transaction.tx),
          publication: {
            operationId,
            announce: (name, payload) => {
              announcements.push([name, payload])
            },
          },
        } as SchedulerState
        schedulerCompositions.execute(command, input, {
          transaction,
          state,
          trace,
        })
        return state.result
      }, trace)
      await publishAll(
        [
          ...announcements,
          [
            schedulerCommandEvents[command],
            { operationId, ...('date' in input ? { date: input.date } : {}) },
          ],
        ],
        operationId,
        { traceId: trace?.traceId, parentId: trace?.spanId },
      )
      return result as SchedulerCommands[typeof command]['result']
    })

  // Vault commands carry resource content: never log their input, and their
  // events and spans only hold ids.
  for (const command of vaultCommandNames)
    runtime.commands.handle(command, async (_name, input, context, trace) => {
      const operationId =
        input.operationId ?? trace?.traceId ?? crypto.randomUUID()
      const effects = sideEffects()
      const result = await commit(
        (transaction) => {
          const state = {
            command,
            input,
            now: now(),
            vault: context.vault,
            root: context.vault.root(transaction.tx),
            compensate: effects.compensate,
            afterCommit: effects.afterCommit,
          } as VaultState
          vaultCompositions.execute(command, input, {
            transaction,
            state,
            trace,
          })
          return state.result
        },
        trace,
        effects,
      )
      await publishAll(
        [
          command === 'resource.content.save'
            ? [
                'resource.content.changed',
                { operationId, id: (input as { id: string }).id },
              ]
            : [vaultCommandEvents[command], { operationId }],
        ],
        operationId,
        { traceId: trace?.traceId, parentId: trace?.spanId },
      )
      await completeEffects(effects, trace)
      return result as VaultCommands[typeof command]['result']
    })

  return {
    ...runtime,
    vault: context.vault,
    compositions: {
      definition: (id: string) => compositions.definition(id),
      replaceCommand: (definition: CommandDefinition) =>
        compositions.replaceCommand(definition),
    },
    workflows: {
      execute: (
        steps: {
          id: string
          command: keyof (MutationCommands & SchedulerCommands & VaultCommands)
          input: unknown
        }[],
      ) =>
        executeWorkflow(steps, (command, input) =>
          runtime.commands.execute(
            command as keyof (MutationCommands &
              SchedulerCommands &
              VaultCommands),
            input as never,
          ),
        ),
    },
    /** Hydrates a committed mutation result by loading the persisted entity so callers receive the fully hydrated record. */
    async hydrate<T>(
      result: MutationResult,
      read: (id: string) => Promise<T | null>,
    ) {
      try {
        const hydrated = await read((result as EntryRecord).id)
        if (!hydrated) throw new Error('Committed entity could not be loaded')
        return hydrated
      } catch (error) {
        context.logger.error(
          'Post-commit hydration failed; write must not be retried automatically',
          { error },
        )
        throw error
      }
    },
  }
}

export const backendRuntime = createBackendRuntime(UnHussleDB.getInstance())
