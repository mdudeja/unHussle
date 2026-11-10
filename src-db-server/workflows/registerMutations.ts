import { Type } from '@sinclair/typebox'
import type { CommandBoundary } from '@c/workflows/composition'
import { commandHeadForKind } from '@c/workflows/contracts'
import type {
  AppEvents,
  MutationInput,
  MutationResult,
  MutationEvent,
} from '@c/workflows/contracts'
import type { ActionContext, Announce } from './contracts'
import type { BackendKernel, BackendExecution } from './kernel'
import { createCommandActions } from './commandActions'
import { commandHandlerRegistry } from './commandHandlers'
import {
  mutationDefinition,
  mutationInputSchema,
  rowOutputSchema,
  rowOutput,
  withoutResourceContent,
} from './composition'

/** Registers mutation definitions and protected domain actions in the application catalog. */
export function registerMutationCommands(kernel: BackendKernel) {
  const {
    context,
    registry: compositions,
    commit,
    sideEffects,
    spanAction,
    publishAll,
    completeEffects,
  } = kernel
  const availableActions = createCommandActions<typeof context>()
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
      run: (value, execution) => {
        const { transaction, actionContext, trace } = execution
        if (!transaction || !actionContext)
          throw new Error('Mutation actions require an atomic mutation context')
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
  /** Creates the execution boundary for mutation commands, validating the requested mutation and applying it atomically with deferred events and side effects. */
  const mutationBoundary = (
    handlerName: string,
  ): CommandBoundary<BackendExecution> => ({
    id: 'mutation',
    run: async (value, execution, execute) => {
      const input = withoutResourceContent(value as MutationInput)
      const { trace } = execution
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
          execute(
            { ...execution, transaction, actionContext },
            input,
          ) as MutationResult,
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
            (name) => [name as keyof AppEvents, event] as Parameters<Announce>,
          ),
        ],
        operationId,
        meta,
      )

      await completeEffects(effects, trace)
      return result
    },
  })
  for (const [name, actions] of Object.entries(commandHandlerRegistry))
    compositions.registerCommand(
      mutationDefinition(name, actions),
      {
        required: actions.map((action) => `kernel.mutation.${action}`),
        protectBindings: true,
      },
      mutationBoundary(name),
    )
}
