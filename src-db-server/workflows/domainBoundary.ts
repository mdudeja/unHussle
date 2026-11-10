import type { CommandBoundary } from '@c/workflows/composition'
import {
  commandHeadForKind,
  type AppEvents,
  type MutationResult,
} from '@c/workflows/contracts'
import type { AtomicDomain } from '@c/extensions/sdk'
import { readEntry } from '@d/domain/entries'
import type { Announce } from './contracts'
import type { BackendKernel, BackendExecution } from './kernel'
import { withoutResourceContent } from './composition'

/** Inline supported domain mutations into one transaction; capabilities expire at its exit. */
export function createDomainBoundary(
  kernel: BackendKernel,
): CommandBoundary<BackendExecution> {
  const {
    context,
    registry: compositions,
    commit,
    sideEffects,
    publishAll,
    completeEffects,
  } = kernel
  return {
    id: 'extension.atomic',
    run: async (_input, execution, execute) => {
      const { trace } = execution
      const operationId = crypto.randomUUID()
      const effects = sideEffects()
      const announcements: Parameters<Announce>[] = []
      const completions: Parameters<Announce>[] = []
      const result = await commit(
        (transaction) => {
          let inTransaction = true
          /** Ensures the atomic domain context is still active and valid before proceeding. */
          const checkDomain = () => {
            if (!inTransaction)
              throw new Error('Atomic domain context has expired')
          }
          const domain: AtomicDomain = {
            mutations: {
              get: (kind, id) => {
                checkDomain()
                return readEntry(transaction, kind, id)
              },
              apply: (input) => {
                checkDomain()
                input = withoutResourceContent(input)
                const verb = {
                  create: 'add',
                  update: 'change',
                  delete: 'delete',
                  deleteAll: 'deleteAll',
                }[input.action]
                const command = `${commandHeadForKind[input.kind]}.${verb}`
                const result = compositions.execute(command, input, {
                  transaction,
                  trace,
                  actionContext: {
                    ...context,
                    operationId,
                    announce: (name, payload) =>
                      announcements.push([name, payload]),
                    compensate: effects.compensate,
                    afterCommit: effects.afterCommit,
                  },
                }) as MutationResult
                const event = { ...input, operationId, result }
                completions.push(
                  [command as keyof AppEvents, event],
                  [`${input.kind}.${verb}` as keyof AppEvents, event],
                )
                return result
              },
            },
          }
          try {
            return execute({ ...execution, transaction, domain })
          } finally {
            inTransaction = false
          }
        },
        trace,
        effects,
      )
      await publishAll([...announcements, ...completions], operationId, {
        traceId: trace?.traceId,
        parentId: trace?.spanId,
      })
      await completeEffects(effects, trace)
      return result
    },
  }
}
