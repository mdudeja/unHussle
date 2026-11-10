import { Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import type { SpanScope, Telemetry } from '@c/workflows/telemetry'
import type {
  ActionDefinition,
  CommandBoundary,
  CommandDefinition,
  createCompositionRegistry,
} from '@c/workflows/composition'
import type {
  Disposable,
  Extension,
  ExtensionContext,
  JsonValue,
  Override,
} from './sdk'
import { SDK_VERSION } from './sdk'

export type ExtensionScope = {
  id: string
  check: () => void
  own: (dispose: Disposable) => Disposable
  assertId: (id: string) => void
}

/** Internal scoped access to the application registry; never exported by the SDK. */
export type ScopedRegistrations<C> = {
  action: (action: ActionDefinition<C>, options?: Override) => Disposable
  command: (
    definition: CommandDefinition,
    options?: Override,
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

/** Owns extension lifetimes. Compilation and execution belong to the supplied application registry. */
export function createExtensionHost<
  S,
  Extra extends object,
  C extends { trace?: SpanScope },
>(options: {
  registry: ReturnType<typeof createCompositionRegistry<C>>
  execute: (id: string, input: unknown) => Promise<unknown>
  services: (scope: ExtensionScope, trace?: SpanScope) => S
  telemetry?: Telemetry
  on: (
    name: string,
    listener: (payload: unknown) => void | Promise<void>,
  ) => Disposable
  settings: {
    get: (owner: string, key: string) => Promise<JsonValue | undefined>
    set: (owner: string, key: string, value: JsonValue) => Promise<void>
  }
  log: (owner: string, message: string, error?: unknown) => void
  extra?: (
    scope: ExtensionScope,
    registrations: ScopedRegistrations<C>,
  ) => Extra
}) {
  const { registry } = options
  const owners = new Map<
    string,
    { owner: string; token: symbol; kind: 'action' | 'command' }
  >()
  const plugins = new Map<string, Disposable>()
  let disposed = false
  /** Ensures the extension host is available and has not been disposed before use. */
  const checkHost = () => {
    if (disposed) throw new Error('Extension host is disposed')
  }

  /** Registers an extension action or command in a scope while enforcing ownership and explicit override rules to prevent collisions. */
  const register = (
    scope: ExtensionScope,
    id: string,
    kind: 'action' | 'command',
    override: Override | undefined,
    install: (replacing: boolean) => void,
  ) => {
    scope.check()
    scope.assertId(id)
    const old = owners.get(id)
    if (
      old &&
      (!override?.override || old.owner !== scope.id || old.kind !== kind)
    )
      throw new Error(
        `Registration collision: ${id}; an override must be explicit and owned`,
      )
    install(!!old)
    const token = Symbol(id)
    owners.set(id, { owner: scope.id, kind, token })
    return scope.own(() => {
      if (owners.get(id)?.token !== token) return
      const revoked = registry.remove(
        kind === 'action' ? [id] : [],
        kind === 'command' ? [id] : [],
      )
      for (const dependent of revoked) owners.delete(dependent)
      owners.delete(id)
    })
  }

  return {
    register: (extension: Extension<S, Extra>): Disposable => {
      checkHost()
      if (
        !/^[a-z][a-z0-9_-]*$/.test(extension.id) ||
        ['kernel', 'unhussle'].includes(extension.id)
      )
        throw new Error(`Invalid extension namespace: ${extension.id}`)
      if (extension.sdkVersion !== SDK_VERSION)
        throw new Error(`Unsupported SDK version: ${extension.sdkVersion}`)
      if (plugins.has(extension.id))
        throw new Error(`Extension already active: ${extension.id}`)
      let active = true
      const disposables: Disposable[] = []

      const scope: ExtensionScope = {
        id: extension.id,
        check: () => {
          checkHost()
          if (!active) throw new Error(`Extension is disposed: ${extension.id}`)
        },
        assertId: (id) => {
          if (
            !id.startsWith(`${extension.id}.`) ||
            !/^[\w-]+(?:\.[\w-]+)+$/.test(id)
          )
            throw new Error(`ID must belong to ${extension.id}: ${id}`)
        },
        own: (dispose) => {
          scope.check()
          let owned = true
          /** Releases the currently owned resource by disposing it, if active. */
          const off = () => {
            if (!owned) return
            owned = false
            dispose()
          }
          disposables.push(off)
          return off
        },
      }

      const registrations: ScopedRegistrations<C> = {
        action: (action, override) =>
          register(scope, action.id, 'action', override, (replacing) => {
            if (replacing) registry.replaceAction(action)
            else registry.registerAction(action)
          }),
        command: (definition, override, boundary) =>
          register(scope, definition.id, 'command', override, (replacing) => {
            if (boundary && definition.execution === 'workflow')
              throw new Error('Atomic commands cannot be workflows')
            for (const step of definition.steps)
              if (step.action && owners.get(step.action)?.kind !== 'action')
                throw new Error(
                  `Action is not exposed to extensions: ${step.action}`,
                )
            if (
              replacing &&
              (registry.boundary(definition.id) !== boundary?.id ||
                (registry.kind(definition.id) === 'workflow') !==
                  (definition.execution === 'workflow'))
            )
              throw new Error(
                `Cannot change execution boundary: ${definition.id}`,
              )
            if (replacing && boundary)
              throw new Error(
                'Atomic command replacement requires a new namespaced ID',
              )
            if (replacing) registry.replaceCommand(definition)
            else registry.registerCommand(definition, undefined, boundary)
          }),
      }

      /** Executes the specified command or workflow after verifying it exists, matches the expected kind, and is permitted by the current scope. */
      const execute = async (
        id: string,
        input: unknown,
        kind: 'command' | 'workflow',
      ) => {
        scope.check()
        if (registry.kind(id) !== kind)
          throw new Error(`Missing ${kind}: ${id}`)
        return options.execute(id, input)
      }

      /** Disposes the extension scope and releases its registered resources. */
      const dispose = () => {
        if (!active) return
        active = false
        for (const off of disposables.reverse()) {
          try {
            off()
          } catch (error) {
            options.log(scope.id, 'Extension cleanup failed', error)
          }
        }
        plugins.delete(scope.id)
      }

      plugins.set(scope.id, dispose)

      const api: ExtensionContext<S> & Extra = {
        id: scope.id,
        sdkVersion: SDK_VERSION,
        services: options.services(scope),
        own: scope.own,
        actions: {
          register: (action, override) =>
            registrations.action(
              {
                ...action,
                execution: 'application',
                run: (input, { trace }) => {
                  scope.check()
                  /** Executes the configured action using services from the current scope. */
                  const invoke = (actionTrace?: SpanScope) =>
                    action.run(input, options.services(scope, actionTrace))
                  return trace && options.telemetry
                    ? options.telemetry.span('action', action.id, invoke, {
                        traceId: trace.traceId,
                        parentId: trace.spanId,
                      })
                    : invoke(trace)
                },
              },
              override,
            ),
        },
        commands: {
          register: (definition, override) => {
            if (definition.execution === 'workflow')
              throw new Error('Use workflows.register for workflow definitions')
            return registrations.command(definition, override)
          },
          execute: (id, input) => execute(id, input, 'command'),
        },
        workflows: {
          register: (definition, override) => {
            for (const step of definition.steps)
              if ('action' in step || registry.kind(step.command) !== 'command')
                throw new Error(
                  `Workflow step ${step.id} needs a registered command`,
                )
            return registrations.command(
              { ...definition, execution: 'workflow' },
              override,
            )
          },
          execute: (id, input) => execute(id, input, 'workflow'),
        },
        events: {
          on: (name, listener) => {
            scope.check()
            return scope.own(
              options.on(name, (payload) => {
                if (active) return listener(payload)
              }),
            )
          },
        },
        settings: {
          get: (key) => {
            scope.check()
            return options.settings.get(scope.id, key)
          },
          set: (key, value) => {
            scope.check()
            if (!Value.Check(jsonSchema, value))
              throw new Error('Settings must be JSON values')
            return options.settings.set(scope.id, key, value)
          },
        },
        log: {
          info: (message) => {
            scope.check()
            options.log(scope.id, message)
          },
          error: (message, error) => {
            scope.check()
            options.log(scope.id, message, error)
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
      for (const off of [...plugins.values()].reverse()) off()
      disposed = true
    },
  }
}
