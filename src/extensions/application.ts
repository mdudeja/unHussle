import type { Telemetry } from '@c/workflows/telemetry'
import type { TraceMeta } from '@c/workflows/runtime'
import type { createCompositionRegistry } from '@c/workflows/composition'
import type { SpanScope } from '@c/workflows/telemetry'
import { createExtensionHost } from '@c/extensions/host'
import type {
  ApplicationServices,
  DomainQueries,
  JsonValue,
  SupportedCommands,
} from '@c/extensions/sdk'
import type { FrontendContributions, ExtensionMenu, ExtensionView } from './sdk'
import type { Logger } from '@c/Logger'
import type { SessionStorage } from '@/workflows/tracking'

/** Creates the frontend extension environment that enables extensions to register menus and views, access host services, and manage their lifecycle and contributions. */
export function createFrontendExtensions(options: {
  registry: ReturnType<typeof createCompositionRegistry<{ trace?: SpanScope }>>
  queries: DomainQueries
  execute: <K extends keyof SupportedCommands>(
    id: K,
    input: SupportedCommands[K]['input'],
    meta?: TraceMeta,
  ) => Promise<SupportedCommands[K]['result']>
  invoke: (id: string, input: unknown) => Promise<unknown>
  telemetry: Telemetry
  on: (
    name: string,
    listener: (value: unknown) => void | Promise<void>,
  ) => () => void
  storage?: SessionStorage
  logger: Logger
}) {
  const menus = new Map<string, ExtensionMenu>()
  const views = new Map<string, ExtensionView>()
  const listeners = new Set<() => void>()
  let snapshot = { menus: [] as ExtensionMenu[], views: [] as ExtensionView[] }
  const memory = new Map<string, JsonValue>()

  /** Notifies all registered listeners after refreshing the snapshot of the current menus and views. */
  const notify = () => {
    snapshot = { menus: [...menus.values()], views: [...views.values()] }
    for (const listener of listeners) listener()
  }

  /** Creates an isolated snapshot of a value once it resolves, so later changes cannot affect the captured result. */
  const snapshotRead = <T>(read: Promise<T>) =>
    read.then((value) => structuredClone(value))
  const host = createExtensionHost<
    ApplicationServices,
    FrontendContributions,
    { trace?: SpanScope }
  >({
    registry: options.registry,
    execute: options.invoke,
    telemetry: options.telemetry,
    services: (scope, trace) => ({
      queries: {
        list: (...args) => {
          scope.check()
          return snapshotRead(options.queries.list(...args))
        },
        get: (...args) => {
          scope.check()
          return snapshotRead(options.queries.get(...args))
        },
        references: (...args) => {
          scope.check()
          return snapshotRead(options.queries.references(...args))
        },
        container: (...args) => {
          scope.check()
          return snapshotRead(options.queries.container(...args))
        },
        taskContext: (...args) => {
          scope.check()
          return snapshotRead(options.queries.taskContext(...args))
        },
      },
      execute: (id, input) => {
        scope.check()
        return options.execute(id, input, {
          traceId: trace?.traceId,
          parentId: trace?.spanId,
        })
      },
    }),
    on: options.on,
    settings: {
      /** Retrieves the stored value associated with the specified owner and key, falling back to in-memory storage when no persisted value exists. */
      get: async (owner, key) => {
        const id = `unhussle.extension.${owner}.${key}`
        const value = options.storage?.getItem(id)
        return value == null
          ? structuredClone(memory.get(id))
          : (JSON.parse(value) as JsonValue)
      },
      /** Stores a value under an owner-scoped key for later retrieval. */
      set: async (owner, key, value) => {
        const id = `unhussle.extension.${owner}.${key}`
        options.storage?.setItem(id, JSON.stringify(value))
        memory.set(id, structuredClone(value))
      },
    },
    log: (owner, message, error) =>
      error === undefined
        ? options.logger.info(`[${owner}] ${message}`)
        : options.logger.error(`[${owner}] ${message}`, { error }),
    /** Provides scoped registration helpers for menu and view contributions with duplicate-ID protection, optional override support, and disposal of registrations. */
    extra: (scope) => {
      /** Registers an item by its unique identifier in a scoped collection, preventing accidental duplicate registrations unless an override is explicitly allowed, and enables the registration to be removed later. */
      const register = <T extends { id: string }>(
        map: Map<string, T>,
        item: T,
        override?: { override?: boolean },
      ) => {
        scope.check()
        scope.assertId(item.id)
        if (map.has(item.id) && !override?.override)
          throw new Error(`Contribution collision: ${item.id}`)
        const value = { ...item }
        map.set(item.id, value)
        notify()
        return scope.own(() => {
          if (map.get(item.id) === value) {
            map.delete(item.id)
            notify()
          }
        })
      }
      return {
        menus: {
          register: (menu, override) => register(menus, menu, override),
        },
        views: {
          register: (view, override) => register(views, view, override),
        },
      }
    },
  })
  return {
    register: (extension: Parameters<typeof host.register>[0]) =>
      host.register(extension),
    dispose: () => {
      host.dispose()
      listeners.clear()
      memory.clear()
    },
    contributions: {
      snapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    },
  }
}
