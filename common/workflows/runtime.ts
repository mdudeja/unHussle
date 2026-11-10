import type { SpanOptions, Telemetry, SpanScope } from '@c/workflows/telemetry'

type Command = { input: unknown; result: unknown }
export type Handler<I, O, C> = (
  command: string,
  input: I,
  context: C,
  /** The span this call runs in; only set when the runtime has telemetry. */
  trace?: SpanScope,
) => O | Promise<O>

/** Where a command or event belongs in an existing trace. */
export type TraceMeta = Pick<SpanOptions, 'traceId' | 'parentId'>

type Listener<C> = {
  handler: Handler<unknown, void, C>
  label: string
}

/** Retrieves an operation identifier from a value when it is available and valid. */
const operationIdOf = (input: unknown) => {
  const value = (input as { operationId?: unknown } | null | undefined)
    ?.operationId
  return typeof value === 'string' ? value : undefined
}

/** One owner for required work; any number of independent completion listeners. */
export function createRuntime<
  Commands extends { [K in keyof Commands]: Command },
  Events extends object,
  Context,
>(context: Context, { telemetry }: { telemetry?: Telemetry } = {}) {
  type Name = keyof Commands
  const handlers = new Map<Name, Handler<unknown, unknown, Context>>()
  const listeners = new Map<keyof Events, Set<Listener<Context>>>()
  const anyListeners = new Set<Listener<Context>>()

  /** Registers a handler with a listener group and provides a way to remove it. */
  const listen = (
    group: Set<Listener<Context>>,
    handler: Handler<unknown, void, Context>,
    label = handler.name || 'anonymous',
  ) => {
    const listener = { handler, label }
    group.add(listener)
    return () => {
      group.delete(listener)
    }
  }

  return {
    telemetry,
    commands: {
      /** Registers a named command handler for later dispatch while preventing duplicate command registrations. */
      handle<K extends Name>(
        name: K,
        handler: Handler<Commands[K]['input'], Commands[K]['result'], Context>,
      ) {
        if (handlers.has(name))
          throw new Error(`Duplicate command: ${String(name)}`)
        const registered = handler as Handler<unknown, unknown, Context>
        handlers.set(name, registered)
        return () => {
          if (handlers.get(name) === registered) handlers.delete(name)
        }
      },
      /** Executes the named command with its registered handler, optionally recording execution as a telemetry span. */
      async execute<K extends Name>(
        name: K,
        input: Commands[K]['input'],
        meta: TraceMeta = {},
      ): Promise<Commands[K]['result']> {
        const handler = handlers.get(name)
        if (!handler) throw new Error(`No handler for command: ${String(name)}`)
        if (!telemetry) return await handler(String(name), input, context)
        return await telemetry.span(
          'command',
          String(name),
          (span) => handler(String(name), input, context, span),
          {
            traceId: meta.traceId ?? operationIdOf(input),
            parentId: meta.parentId,
          },
        )
      },
    },
    events: {
      /** Registers an event handler for the specified event name. */
      on<K extends keyof Events>(
        name: K,
        handler: Handler<Events[K], void, Context>,
        { label }: { label?: string } = {},
      ) {
        const group = listeners.get(name) ?? new Set()
        listeners.set(name, group)
        return listen(group, handler as Handler<unknown, void, Context>, label)
      },
      /** Listens to every published event, e.g. for forwarding or logging. */
      onAny(
        handler: Handler<Events[keyof Events], void, Context>,
        { label }: { label?: string } = {},
      ) {
        return listen(
          anyListeners,
          handler as Handler<unknown, void, Context>,
          label,
        )
      },
      /** Publishes an event to all registered listeners for the event name, with telemetry tracing when enabled. */
      async publish<K extends keyof Events>(
        name: K,
        payload: Events[K],
        meta: TraceMeta = {},
      ) {
        const targets = [...(listeners.get(name) ?? []), ...anyListeners]
        if (!telemetry)
          return Promise.allSettled(
            targets.map(({ handler }) =>
              Promise.resolve().then(() =>
                handler(String(name), payload, context),
              ),
            ),
          )

        const event = telemetry.start('event', String(name), {
          traceId: meta.traceId ?? operationIdOf(payload),
          parentId: meta.parentId,
          attrs: { listeners: targets.length },
        })
        const outcomes = await Promise.allSettled(
          targets.map(({ handler, label }) =>
            Promise.resolve().then(() =>
              telemetry.span(
                'listener',
                label,
                (span) => handler(String(name), payload, context, span),
                {
                  traceId: event.traceId,
                  parentId: event.spanId,
                  attrs: { event: String(name) },
                },
              ),
            ),
          ),
        )
        const failed = outcomes.filter(
          (outcome) => outcome.status === 'rejected',
        ).length
        if (failed) event.setAttrs({ failed })
        event.end()
        return outcomes
      },
    },
    /** Releases all registered event handlers and listeners. */
    dispose() {
      handlers.clear()
      listeners.clear()
      anyListeners.clear()
    },
  }
}
