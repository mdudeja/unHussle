import type { SpanScope } from '@c/workflows/telemetry'
import { Type, type TSchema } from '@sinclair/typebox'
import {
  type createCompositionRegistry,
  type CommandBoundary,
  type CommandDefinition,
} from '@c/workflows/composition'
import type { MutationInput, MutationResult } from '@c/workflows/contracts'
import { commandHeadForKind } from '@c/workflows/contracts'
import type { TransactionContext } from './contracts'
import {
  generatePlanSchema,
  replanSchema,
  adjustPlanSchema,
  changeModeSchema,
  schedulerSettingsSchema,
  transitionOccurrenceSchema,
  stopTrackingSchema,
  selectDayPlanSchema,
  selectOccurrenceSchema,
  selectTimeEntriesSchema,
  saveResourceContentSchema,
  savedResourceContentSchema,
  changeVaultSchema,
  vaultInfoSchema,
  rescanResultSchema,
} from '@d/database/validation'

export const stateCommandSchemas: Record<
  string,
  { input: TSchema; output: TSchema }
> = {
  'scheduler.generate': {
    input: generatePlanSchema,
    output: selectDayPlanSchema,
  },
  'scheduler.replan': { input: replanSchema, output: selectDayPlanSchema },
  'scheduler.adjust': { input: adjustPlanSchema, output: selectDayPlanSchema },
  'scheduler.mode.change': {
    input: changeModeSchema,
    output: selectDayPlanSchema,
  },
  'scheduler.settings.change': {
    input: Type.Object({ settings: schedulerSettingsSchema }),
    output: schedulerSettingsSchema,
  },
  'scheduler.occurrence.transition': {
    input: transitionOccurrenceSchema,
    output: selectOccurrenceSchema,
  },
  'scheduler.tracking.stop': {
    input: stopTrackingSchema,
    output: selectTimeEntriesSchema,
  },
  'resource.content.save': {
    input: Type.Object({
      ...saveResourceContentSchema.properties,
      id: Type.String(),
    }),
    output: savedResourceContentSchema,
  },
  'vault.rescan': { input: Type.Object({}), output: rescanResultSchema },
  'vault.settings.change': {
    input: changeVaultSchema,
    output: vaultInfoSchema,
  },
}

export const mutationInputSchema = Type.Object({
  kind: Type.Union(
    Object.keys(commandHeadForKind).map((kind) => Type.Literal(kind)),
  ),
  action: Type.Union(
    ['create', 'update', 'delete', 'deleteAll'].map((verb) =>
      Type.Literal(verb),
    ),
  ),
  operationId: Type.Optional(Type.String()),
  id: Type.Optional(Type.String()),
  ids: Type.Optional(Type.Array(Type.String())),
  attachedIds: Type.Optional(Type.Array(Type.String())),
  changes: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
})
const row = Type.Object({ id: Type.String() }, { additionalProperties: true })
export const mutationResultSchema = Type.Union([
  row,
  Type.Array(row),
  Type.Undefined(),
])
export const rowOutputSchema = Type.Object({
  input: mutationInputSchema,
  result: mutationResultSchema,
})

/** Only row operations bind affected IDs; integrity actions have no implicit outputs. */
export function rowOutput(input: MutationInput, result: MutationResult) {
  const next = { ...input }
  const ids = Array.isArray(result)
    ? result.map((row) => row.id)
    : result
      ? [result.id]
      : undefined
  if (result && !Array.isArray(result)) next.id = result.id
  if (ids && (input.action === 'delete' || input.action === 'deleteAll')) {
    if (['tags', 'urls', 'time_entries'].includes(input.kind)) next.ids = ids
    else next.attachedIds = ids
  }
  return { input: next, result }
}

/** Defines a built-in mutation command from an ordered sequence of actions, ensuring it includes a row operation and that the row-mutating step drives subsequent steps and the final result. */
export function mutationDefinition(
  id: string,
  actions: string[],
): CommandDefinition {
  const rowIndex = actions.findIndex((name) =>
    ['createRow', 'updateRow', 'deleteRow', 'deleteAllRows'].includes(name),
  )
  if (rowIndex < 0) throw new Error(`Missing row operation in ${id}`)
  return {
    id,
    description: `Built-in ${id}`,
    input: mutationInputSchema,
    output: mutationResultSchema,
    steps: actions.map((name, index) => ({
      id: `step${index}`,
      action: `kernel.mutation.${name}`,
      input:
        index > rowIndex
          ? { from: 'step', step: `step${rowIndex}`, path: ['input'] }
          : { from: 'input' },
    })),
    result: { from: 'step', step: `step${rowIndex}`, path: ['result'] },
  }
}

/** Scheduler/vault state stays private typed domain code; compositions bind its declared envelope. */
export function registerStateCommands<
  E,
  S extends { done?: boolean; result?: unknown },
  C extends TransactionContext,
  N extends string,
>(
  registry: ReturnType<typeof createCompositionRegistry<E>>,
  handlers: Record<string, string[]>,
  actions: Partial<Record<N, (name: N, state: S, context: C) => unknown>>,
  namespace: string,
  execution: (context: E) => { transaction: C; state: S; trace?: SpanScope },
  span: (name: string, run: () => void, trace?: SpanScope) => void,
  boundary: (id: string) => CommandBoundary<E>,
) {
  const envelope = Type.Unknown()
  for (const [name, action] of Object.entries(actions))
    registry.registerAction({
      id: `${namespace}.${name}`,
      description: name,
      input: envelope,
      output: envelope,
      run: (input, context) => {
        const { transaction, state, trace } = execution(context)
        if (!state.done)
          span(
            name,
            () => {
              const result = (
                action as (name: N, state: S, context: C) => unknown
              )(name as N, state, transaction)
              if (
                result &&
                typeof (result as { then?: unknown }).then === 'function'
              )
                throw new Error('Atomic actions must be synchronous')
            },
            trace,
          )
        return input
      },
    })
  for (const [id, names] of Object.entries(handlers)) {
    const schemas = stateCommandSchemas[id]
    if (!schemas) throw new Error(`Missing command schemas: ${id}`)
    const resultAction = `${namespace}.result.${id}`
    registry.registerAction({
      id: resultAction,
      description: `Result of ${id}`,
      input: envelope,
      output: schemas.output,
      run: (_input, context) => execution(context).state.result,
    })
    registry.registerCommand(
      {
        id,
        description: `Built-in ${id}`,
        input: Type.Object({
          ...schemas.input.properties,
          operationId: Type.Optional(Type.String()),
        }),
        output: schemas.output,
        steps: [
          ...names.map((name, index) => ({
            id: `step${index}`,
            action: `${namespace}.${name}`,
            input: { from: 'input' as const },
          })),
          { id: 'result', action: resultAction, input: { from: 'input' } },
        ],
        result: { from: 'step', step: 'result' },
      },
      {
        required: [
          ...names.map((name) => `${namespace}.${name}`),
          resultAction,
        ],
      },
      boundary(id),
    )
  }
}

/** Unsupported entity content must never reach logs, completion events, or replay buffers. */
export function withoutResourceContent(input: MutationInput): MutationInput {
  if (!input.changes || !('content' in input.changes)) return input
  const { content: _content, ...changes } = input.changes
  return { ...input, changes }
}
