import { createRuntime } from '@c/workflows/runtime'
import type {
  ActionContext,
  Announce,
  AppEvents,
  MutationCommands,
  MutationEvent,
  MutationInput,
  MutationResult,
  EntryRecord,
  CommandAction,
  TransactionWorkUnit,
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
import { vaultActions, type VaultState } from '@d/workflows/vaultActions'
import { vaultHandlerRegistry } from '@d/workflows/vaultHandlers'

const supporterKinds: MutationInput['kind'][] = ['tags', 'urls', 'time_entries']

/**
 * Goes through the list and replaces any action that starts with handler: with the actions for that handler, recursively.
 * and returns the cleaned list.
 * */
function replaceNestedActions(
  actionList: CommandAction[],
  visited: Set<keyof MutationCommands> = new Set(),
): CommandAction[] {
  const cleanedList: CommandAction[] = []
  for (const action of actionList) {
    if (action.startsWith('handler:')) {
      const handlerName = action.replace(
        'handler:',
        '',
      ) as keyof MutationCommands
      if (visited.has(handlerName)) {
        throw new Error(`Circular command handler reference: ${handlerName}`)
      }
      const nestedActions = commandHandlerRegistry[handlerName]
      if (nestedActions && nestedActions.length > 0) {
        const replacedNestedActions = replaceNestedActions(
          nestedActions,
          new Set(visited).add(handlerName),
        )
        cleanedList.push(...replacedNestedActions)
      }
    } else {
      cleanedList.push(action)
    }
  }
  return cleanedList
}

/** Feeds an action's output into the input of the next action in the chain. */
function carryForward(input: MutationInput, result: MutationResult) {
  let ids: string[] | undefined
  const next = { ...input }

  if (Array.isArray(result)) {
    ids = result.map((row) => row.id)
  } else if (result && 'id' in result) {
    next.id = result.id
    ids = [result.id]
  }

  if (ids && (input.action === 'delete' || input.action === 'deleteAll')) {
    if (supporterKinds.includes(input.kind)) {
      next.ids = ids
    } else {
      next.attachedIds = ids
    }
  }

  return next
}

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
    const afterCommits: (() => void)[] = []
    return {
      undos,
      afterCommits,
      compensate: (undo: () => void) => {
        undos.push(undo)
      },
      afterCommit: (run: () => void) => {
        afterCommits.push(run)
      },
    }
  }

  /**
   * Runs work units in one transaction; a failure rolls the command back and
   * undoes its file changes, newest first. After a commit, the after-commit
   * cleanup runs; its failures are only logged.
   */
  const commit = async <T>(
    work: TransactionWorkUnit<T>[],
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
    for (const run of effects?.afterCommits ?? []) {
      try {
        run()
      } catch (error) {
        context.logger.error('Post-commit cleanup failed', {
          error,
          traceId: trace?.traceId,
        })
      }
    }
    return result
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

  /** Publishes after commit; a failing listener never fails the command. */
  const publishAll = async (
    events: Parameters<Announce>[],
    operationId: string,
    meta: { traceId?: string; parentId?: string },
  ) => {
    const outcomes = (
      await Promise.all(
        events.map(([name, payload]) =>
          runtime.events.publish(name, payload, meta),
        ),
      )
    ).flat()
    for (const outcome of outcomes)
      if (outcome.status === 'rejected')
        context.logger.error(`Post-commit listener failed (${operationId})`, {
          error: outcome.reason,
          traceId: meta.traceId,
        })
  }

  for (const commandName in commandHandlerRegistry) {
    runtime.commands.handle(
      commandName as keyof MutationCommands,
      async (handlerName, input, context, trace) => {
        const { logger } = context
        // Payloads hold user data, so they are only logged at debug level.
        logger.debug(
          `Executing command: ${handlerName} for input: ${JSON.stringify(input)}`,
          { traceId: trace?.traceId },
        )
        const actionsForCommand =
          commandHandlerRegistry[handlerName as keyof MutationCommands]

        if (!actionsForCommand || actionsForCommand.length === 0) {
          return
        }

        const operationId =
          input.operationId ?? trace?.traceId ?? crypto.randomUUID()
        const verb = handlerName.slice(handlerName.indexOf('.') + 1)
        let currentInput: MutationInput = input

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

        // Units are built lazily so each action sees the previous action's output.
        const work = replaceNestedActions(actionsForCommand).map(
          (actionName): TransactionWorkUnit<MutationResult> =>
            (transaction) => {
              const action = availableActions[actionName]
              if (!action) {
                logger.warn(`Action not found: ${actionName}. Skipping...`)
                return
              }

              return spanAction(
                trace,
                actionName,
                { kind: input.kind, verb },
                (span) => {
                  const unit = action(actionName, currentInput, actionContext)
                  if (unit instanceof Promise)
                    throw new Error(
                      `Action ${actionName} must return its work unit synchronously`,
                    )

                  const result = unit(transaction)
                  currentInput = carryForward(currentInput, result)
                  if (Array.isArray(result))
                    span?.setAttrs({ rows: result.length })
                  return result
                },
              )
            },
        )

        const result = await commit(work, trace, effects)

        // Publish under the command (`entity.add`) and its kind (`tasks.add`)
        // so listeners can subscribe to a whole family or a single kind.
        const event: MutationEvent = { ...input, operationId, result }
        const eventNames = new Set([handlerName, `${input.kind}.${verb}`])
        const meta = { traceId: trace?.traceId, parentId: trace?.spanId }
        trace?.setAttrs({
          kind: input.kind,
          operationId,
          announcements: announcements.length,
          events: [...eventNames, ...announcements.map(([name]) => name)].join(
            ',',
          ),
        })

        await publishAll(
          [
            ...[...eventNames].map(
              (name) =>
                [name as keyof AppEvents, event] as Parameters<Announce>,
            ),
            ...announcements,
          ],
          operationId,
          meta,
        )

        return result
      },
    )
  }

  // Scheduler commands run their registered actions over one carried state.
  for (const command of schedulerCommandNames)
    runtime.commands.handle(command, async (_name, input, context, trace) => {
      const operationId =
        input.operationId ?? trace?.traceId ?? crypto.randomUUID()
      const result = await commit(
        [
          (transaction) => {
            const state = {
              command,
              input,
              now: now(),
              settings: readSettings(transaction.tx),
            } as SchedulerState
            for (const actionName of schedulerHandlerRegistry[command]) {
              if (state.done) break
              const action = schedulerActions[actionName]
              if (!action) {
                context.logger.warn(
                  `Scheduler action not found: ${actionName}. Skipping...`,
                )
                continue
              }
              spanAction(trace, actionName, { command }, () =>
                action(actionName, state, transaction),
              )
            }
            return state.result
          },
        ],
        trace,
      )
      await publishAll(
        [
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
        [
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
            for (const actionName of vaultHandlerRegistry[command]) {
              if (state.done) break
              const action = vaultActions[actionName]
              if (!action) {
                context.logger.warn(
                  `Vault action not found: ${actionName}. Skipping...`,
                )
                continue
              }
              spanAction(trace, actionName, { command }, () =>
                action(actionName, state, transaction),
              )
            }
            return state.result
          },
        ],
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
      return result as VaultCommands[typeof command]['result']
    })

  return {
    ...runtime,
    vault: context.vault,
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
