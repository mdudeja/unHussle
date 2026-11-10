import { commandTracing } from '@c/workflows/registration'
import { createCompositionRegistry } from '@c/workflows/composition'
import { createRuntime } from '@c/workflows/runtime'
import type { AtomicDomain } from '@c/extensions/sdk'
import type { AppEvents, MutationCommands } from '@c/workflows/contracts'
import type { SchedulerCommands } from '@c/scheduler/contracts'
import type { VaultCommands } from '@c/vault/contracts'
import { Logger } from '@c/Logger'
import { getNowMillis } from '@c/datetimeUtils'
import type { UnHussleDB } from '@d/database/UnHussleDB'
import { createUnitOfWork } from './unitOfWork'
import { createVault, defaultVaultRoot } from '@d/vault/vault'
import { backendTelemetry } from './telemetry'
import type { Telemetry, SpanScope } from '@c/workflows/telemetry'
import type {
  ActionContext,
  Announce,
  TransactionContext,
  TransactionWorkUnit,
  VaultState,
} from './contracts'
import type { SchedulerState } from './schedulerActions'

type BackendContext = {
  now: () => number
  unitOfWork: ReturnType<typeof createUnitOfWork>
  logger: ReturnType<typeof Logger.getInstance>
  vault: ReturnType<typeof createVault>
}
export type BackendExecution = {
  trace?: SpanScope
  transaction?: TransactionContext
  actionContext?: ActionContext<BackendContext>
  state?: SchedulerState | VaultState
  domain?: AtomicDomain
}

/** Creates the backend runtime that provides the command, workflow, scheduling, and vault execution capabilities for the application. */
export function createBackendKernel(
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
  const compositions = createCompositionRegistry<BackendExecution>(
    commandTracing(telemetry),
  )
  const runtime = createRuntime<
    MutationCommands & SchedulerCommands & VaultCommands,
    AppEvents,
    typeof context
  >(context, {
    telemetry,
    registry: compositions,
  })
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

  /** Creates a mutation command boundary that validates each mutation against its handler, runs it atomically, and publishes its resulting events after commit. */
  return {
    context,
    runtime,
    registry: compositions,
    telemetry,
    sideEffects,
    commit,
    completeEffects,
    spanAction,
    publishAll,
  }
}
export type BackendKernel = ReturnType<typeof createBackendKernel>
