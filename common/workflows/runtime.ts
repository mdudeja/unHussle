type Command = { input: unknown; result: unknown }
export type Handler<I, O, C> = (
  command: string,
  input: I,
  context: C,
) => O | Promise<O>

/** One owner for required work; any number of independent completion listeners. */
export function createRuntime<
  Commands extends { [K in keyof Commands]: Command },
  Events extends object,
  Context,
>(context: Context) {
  type Name = keyof Commands
  const handlers = new Map<Name, Handler<unknown, unknown, Context>>()
  const listeners = new Map<
    keyof Events,
    Set<Handler<unknown, void, Context>>
  >()
  return {
    commands: {
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
      async execute<K extends Name>(
        name: K,
        input: Commands[K]['input'],
      ): Promise<Commands[K]['result']> {
        const handler = handlers.get(name)
        if (!handler) throw new Error(`No handler for command: ${String(name)}`)
        return await handler(String(name), input, context)
      },
    },
    events: {
      on<K extends keyof Events>(
        name: K,
        handler: Handler<Events[K], void, Context>,
      ) {
        const registered = handler as Handler<unknown, void, Context>
        const group = listeners.get(name) ?? new Set()
        group.add(registered)
        listeners.set(name, group)
        return () => {
          group.delete(registered)
        }
      },
      publish<K extends keyof Events>(name: K, payload: Events[K]) {
        return Promise.allSettled(
          [...(listeners.get(name) ?? [])].map((listener) =>
            Promise.resolve().then(() =>
              listener(String(name), payload, context),
            ),
          ),
        )
      },
    },
    dispose() {
      handlers.clear()
      listeners.clear()
    },
  }
}
