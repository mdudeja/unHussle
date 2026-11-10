import type { CommandBoundary } from '@c/workflows/composition'
import {
  schedulerCommandEvents,
  type SchedulerCommands,
} from '@c/scheduler/contracts'
import { vaultCommandEvents, type VaultCommands } from '@c/vault/contracts'
import type { Announce, VaultState } from './contracts'
import type { BackendKernel, BackendExecution } from './kernel'
import { readSettings } from './scheduler'
import { schedulerActions, type SchedulerState } from './schedulerActions'
import { schedulerHandlerRegistry } from './schedulerHandlers'
import { vaultActions } from './vaultActions'
import { vaultHandlerRegistry } from './vaultHandlers'
import { registerStateCommands } from './composition'

/** Scheduler and vault algorithms retain typed state behind the shared transaction boundary. */
export function registerStatefulCommands(kernel: BackendKernel) {
  const {
    context,
    registry: compositions,
    commit,
    sideEffects,
    spanAction,
    publishAll,
    completeEffects,
  } = kernel
  const { now } = context
  // Scheduler commands run their registered actions over one carried state.
  const schedulerBoundary = (
    command: string,
  ): CommandBoundary<BackendExecution> => ({
    id: `scheduler.${command}`,
    run: async (value, execution, execute) => {
      const input = value as SchedulerCommands[keyof SchedulerCommands]['input']
      const { trace } = execution
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
        return execute({ ...execution, transaction, state })
      }, trace)
      await publishAll(
        [
          ...announcements,
          [
            schedulerCommandEvents[command as keyof SchedulerCommands],
            { operationId, ...('date' in input ? { date: input.date } : {}) },
          ],
        ],
        operationId,
        { traceId: trace?.traceId, parentId: trace?.spanId },
      )
      return result
    },
  })

  registerStateCommands(
    compositions,
    schedulerHandlerRegistry,
    schedulerActions,
    'kernel.scheduler',
    (execution) => {
      if (!execution.transaction || !execution.state)
        throw new Error('Scheduler actions require an atomic context')
      return {
        transaction: execution.transaction,
        state: execution.state as SchedulerState,
        trace: execution.trace,
      }
    },
    (name, run, trace) => spanAction(trace, name, {}, run),
    schedulerBoundary,
  )

  // Vault commands carry resource content: never log their input, and their
  // events and spans only hold ids.
  const vaultBoundary = (
    command: string,
  ): CommandBoundary<BackendExecution> => ({
    id: `vault.${command}`,
    run: async (value, execution, execute) => {
      const input = value as VaultCommands[keyof VaultCommands]['input']
      const { trace } = execution
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
          return execute({ ...execution, transaction, state })
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
            : [
                vaultCommandEvents[command as keyof VaultCommands],
                { operationId },
              ],
        ],
        operationId,
        { traceId: trace?.traceId, parentId: trace?.spanId },
      )
      await completeEffects(effects, trace)
      return result
    },
  })

  registerStateCommands(
    compositions,
    vaultHandlerRegistry,
    vaultActions,
    'kernel.vault',
    (execution) => {
      if (!execution.transaction || !execution.state)
        throw new Error('Vault actions require an atomic context')
      return {
        transaction: execution.transaction,
        state: execution.state as VaultState,
        trace: execution.trace,
      }
    },
    (name, run, trace) => spanAction(trace, name, {}, run),
    vaultBoundary,
  )
}
