import type { Telemetry, SpanScope } from './telemetry'
import { Type, type TSchema } from '@sinclair/typebox'
import type { createCompositionRegistry } from './composition'

/** Registers a leaf command once, with its executable action in the same catalog. */
export function registerCommandHandler<C>(
  registry: ReturnType<typeof createCompositionRegistry<C>>,
  id: string,
  run: (input: unknown, context: C) => unknown,
  input: TSchema = Type.Unknown(),
  output: TSchema = Type.Unknown(),
) {
  if (registry.kind(id)) throw new Error(`Duplicate command: ${id}`)
  const action = `kernel.handler.${id}`
  registry.registerAction({
    id: action,
    description: id,
    input,
    output,
    execution: 'application',
    run,
  })
  try {
    registry.registerCommand({
      id,
      description: id,
      input,
      output,
      steps: [{ id: 'execute', action, input: { from: 'input' } }],
      result: { from: 'step', step: 'execute' },
    })
  } catch (error) {
    registry.remove([action])
    throw error
  }
  let active = true
  return () => {
    if (!active) return
    active = false
    registry.remove([action], [id])
  }
}

/** Nested workflow commands retain their own spans while using the same cached plans. */
export function commandTracing<C extends { trace?: SpanScope }>(
  telemetry?: Telemetry,
) {
  return {
    invokeCommand: (
      id: string,
      context: C,
      run: (context: C) => Promise<unknown>,
    ) => {
      const parent = context.trace
      return telemetry && parent
        ? telemetry.span('command', id, (trace) => run({ ...context, trace }), {
            traceId: parent.traceId,
            parentId: parent.spanId,
          })
        : run(context)
    },
  }
}
