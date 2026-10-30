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

export function createBackendRuntime(database: UnHussleDB) {
  const context = {
    unitOfWork: createUnitOfWork(database),
    logger: Logger.getInstance(),
  }
  const runtime = createRuntime<MutationCommands, AppEvents, typeof context>(
    context,
  )
  const availableActions = createCommandActions<typeof context>()

  for (const commandName in commandHandlerRegistry) {
    runtime.commands.handle(
      commandName as keyof MutationCommands,
      async (handlerName, input, context) => {
        const { unitOfWork, logger } = context
        logger.info(
          `Executing command: ${handlerName} for input: ${JSON.stringify(input)}`,
        )
        const actionsForCommand =
          commandHandlerRegistry[handlerName as keyof MutationCommands]

        if (!actionsForCommand || actionsForCommand.length === 0) {
          return
        }

        const operationId = crypto.randomUUID()
        let currentInput: MutationInput = input

        // Announcements are held until commit and dropped on rollback.
        const announcements: Parameters<Announce>[] = []
        const actionContext: ActionContext<typeof context> = {
          ...context,
          operationId,
          announce: (name, payload) => {
            announcements.push([name, payload])
          },
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

              const unit = action(actionName, currentInput, actionContext)
              if (unit instanceof Promise)
                throw new Error(
                  `Action ${actionName} must return its work unit synchronously`,
                )

              const result = unit(transaction)
              currentInput = carryForward(currentInput, result)
              return result
            },
        )

        const result = await unitOfWork.transaction(work)

        // Publish under the command (`entity.add`) and its kind (`tasks.add`)
        // so listeners can subscribe to a whole family or a single kind.
        const event: MutationEvent = { ...input, operationId, result }
        const verb = handlerName.slice(handlerName.indexOf('.') + 1)
        const eventNames = new Set([handlerName, `${input.kind}.${verb}`])

        const outcomes = (
          await Promise.all([
            ...[...eventNames].map((name) =>
              runtime.events.publish(name as keyof AppEvents, event),
            ),
            ...announcements.map(([name, payload]) =>
              runtime.events.publish(name, payload),
            ),
          ])
        ).flat()
        for (const outcome of outcomes)
          if (outcome.status === 'rejected') {
            logger.error(
              `Post-commit listener failed (${operationId}): ${String(outcome.reason)}`,
            )
          }

        return result
      },
    )
  }

  return {
    ...runtime,
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
          `Post-commit hydration failed; write must not be retried automatically: ${String(error)}`,
        )
        throw error
      }
    },
  }
}

export const backendRuntime = createBackendRuntime(UnHussleDB.getInstance())
