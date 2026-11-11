import { Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import type { Logger } from '@c/Logger'
import type { TraceMeta } from '@c/workflows/runtime'
import type { SpanScope, Telemetry } from '@c/workflows/telemetry'
import type {
  ActionDefinition,
  CommandBoundary,
  CommandDefinition,
  createCompositionRegistry,
} from '@c/workflows/composition'
import type {
  ApplicationServices,
  Disposable,
  DomainQueries,
  Extension,
  ExtensionContext,
  JsonValue,
  SupportedCommands,
} from '@c/extensions/sdk'
import { assertExtensionId } from '@c/extensions/manifest'
import { AppEvents, FrontendEvents } from '@c/workflows/contracts'

export type ExtensionScope = {
  id: string
  check: () => void
  own: (dispose: Disposable) => Disposable
  assertId: (id: string) => void
}

/** Registry access for platform-specific contributions; not part of the SDK. */
export type ScopedRegistrations<C> = {
  action: (
    action: Omit<ActionDefinition<C>, 'run'> & {
      run: (input: unknown, context: C, span?: SpanScope) => unknown
    },
  ) => Disposable
  command: (
    definition: CommandDefinition,
    boundary?: CommandBoundary<C>,
  ) => Disposable
}

const jsonSchema = Type.Recursive((self) =>
  Type.Union([
    Type.Null(),
    Type.Boolean(),
    Type.Number(),
    Type.String(),
    Type.Array(self),
    Type.Record(Type.String(), self),
  ]),
)

/** Owns extension lifetimes; compilation and execution stay in the registry. */
export function createExtensionHost<
  Extra extends object,
  C extends { trace?: SpanScope },
>(options: {
  registry: ReturnType<typeof createCompositionRegistry<C>>
  /** Typed built-in commands, for `services.execute`. */
  execute: <K extends keyof SupportedCommands>(
    id: K,
    input: SupportedCommands[K]['input'],
    meta?: TraceMeta,
  ) => Promise<SupportedCommands[K]['result']>
  /** Any registered command by ID, for `api.commands.execute`. */
  invoke: (id: string, input: unknown) => Promise<unknown>
  queries: DomainQueries
  /** Applied to every query result before an extension sees it. */
  detach?: <T>(value: T) => T
  telemetry?: Telemetry
  on: (
    name: keyof AppEvents | keyof FrontendEvents,
    listener: (payload: unknown) => void | Promise<void>,
  ) => Disposable
  settings: {
    get: (owner: string, key: string) => Promise<JsonValue | undefined>
    set: (owner: string, key: string, value: JsonValue) => Promise<void>
  }
  logger: Logger
  extra?: (
    scope: ExtensionScope,
    registrations: ScopedRegistrations<C>,
  ) => Extra
}) {
  const { registry, telemetry, logger } = options
  // Tokens stop a stale disposer from removing a later registration of the same ID.
  const registered = new Map<string, { token: symbol; isAction: boolean }>()
  const active = new Map<string, Disposable>()
  let disposed = false

  const register = (
    scope: ExtensionScope,
    id: string,
    isAction: boolean,
    install: () => void,
  ) => {
    scope.check()
    scope.assertId(id)
    install()
    const token = Symbol(id)
    registered.set(id, { token, isAction })
    return scope.own(() => {
      if (registered.get(id)?.token !== token) return
      const revoked = isAction
        ? registry.remove([id])
        : registry.remove([], [id])
      for (const dependent of revoked) registered.delete(dependent)
      registered.delete(id)
    })
  }

  const queriesFor = (scope: ExtensionScope) =>
    Object.fromEntries(
      Object.entries(options.queries).map(([name, read]) => [
        name,
        (...args: unknown[]) => {
          scope.check()
          const result = (read as (...args: unknown[]) => Promise<unknown>)(
            ...args,
          )
          return options.detach ? result.then(options.detach) : result
        },
      ]),
    ) as DomainQueries

  return {
    register: (id: string, extension: Extension<Extra>): Disposable => {
      if (disposed) throw new Error('Extension host is disposed')
      assertExtensionId(id)
      if (active.has(id)) throw new Error(`Extension already active: ${id}`)
      let live = true
      const disposables: Disposable[] = []

      const scope: ExtensionScope = {
        id,
        check: () => {
          if (!live) throw new Error(`Extension is disposed: ${id}`)
        },
        assertId: (registrationId) => {
          if (
            !registrationId.startsWith(`${id}.`) ||
            !/^[\w-]+(?:\.[\w-]+)+$/.test(registrationId)
          )
            throw new Error(`ID must belong to ${id}: ${registrationId}`)
        },
        own: (dispose) => {
          scope.check()
          let owned = true
          const off = () => {
            if (!owned) return
            owned = false
            dispose()
          }
          disposables.push(off)
          return off
        },
      }

      const queries = queriesFor(scope)
      const services = (trace?: SpanScope): ApplicationServices => ({
        queries,
        execute: (commandId, input) => {
          scope.check()
          return options.execute(commandId, input, {
            traceId: trace?.traceId,
            parentId: trace?.spanId,
          })
        },
      })

      const registrations: ScopedRegistrations<C> = {
        action: (action) =>
          register(scope, action.id, true, () =>
            registry.registerAction({
              ...action,
              run: (input, context) => {
                scope.check()
                const { trace } = context
                const run = (span?: SpanScope) =>
                  action.run(input, context, span)
                return trace && telemetry
                  ? telemetry.span('action', action.id, run, {
                      traceId: trace.traceId,
                      parentId: trace.spanId,
                      attrs: { extension: id },
                    })
                  : run(trace)
              },
            }),
          ),
        command: (definition, boundary) =>
          register(scope, definition.id, false, () => {
            for (const step of definition.steps)
              if (step.action && !registered.get(step.action)?.isAction)
                throw new Error(
                  `Action is not exposed to extensions: ${step.action}`,
                )
            registry.registerCommand(definition, undefined, boundary)
          }),
      }

      const dispose = () => {
        if (!live) return
        live = false
        for (const off of disposables.reverse()) {
          try {
            off()
          } catch (error) {
            logger.error(`[${id}] Extension cleanup failed`, { error })
          }
        }
        active.delete(id)
      }
      active.set(id, dispose)

      const api: ExtensionContext & Extra = {
        id,
        services: services(),
        own: scope.own,
        actions: {
          register: (action) =>
            registrations.action({
              ...action,
              execution: 'application',
              run: (input, _context, span) => action.run(input, services(span)),
            }),
        },
        commands: {
          register: (definition) => {
            if (definition.execution === 'workflow')
              throw new Error('Use workflows.register for workflow definitions')
            return registrations.command(definition)
          },
          execute: (commandId, input) => {
            scope.check()
            return options.invoke(commandId, input)
          },
        },
        workflows: {
          register: (definition) => {
            for (const step of definition.steps)
              if ('action' in step || registry.kind(step.command) !== 'command')
                throw new Error(
                  `Workflow step ${step.id} needs a registered command`,
                )
            return registrations.command({
              ...definition,
              execution: 'workflow',
            })
          },
        },
        events: {
          on: (name, listener) => {
            scope.check()
            return scope.own(
              options.on(name as keyof AppEvents, (payload) => {
                if (live) return listener(payload)
              }),
            )
          },
        },
        settings: {
          get: (key) => {
            scope.check()
            return options.settings.get(id, key)
          },
          set: (key, value) => {
            scope.check()
            if (!Value.Check(jsonSchema, value))
              throw new Error('Settings must be JSON values')
            return options.settings.set(id, key, value)
          },
        },
        log: {
          info: (message) => {
            scope.check()
            logger.info(`[${id}] ${message}`)
          },
          error: (message, error) => {
            scope.check()
            logger.error(`[${id}] ${message}`, { error })
          },
        },
        ...(options.extra?.(scope, registrations) ?? ({} as Extra)),
      }

      try {
        const cleanup = extension.activate(api)
        if (cleanup !== undefined && typeof cleanup !== 'function')
          throw new Error('Extension activation must be synchronous')
        if (cleanup) scope.own(cleanup)
      } catch (error) {
        dispose()
        throw error
      }
      return dispose
    },
    dispose: () => {
      for (const off of [...active.values()].reverse()) off()
      disposed = true
    },
  }
}
