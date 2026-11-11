import { createExtensionHost } from '@c/extensions/host'
import type { JsonValue } from '@c/extensions/sdk'
import type { SpanScope } from '@c/workflows/telemetry'
import type { SessionStorage } from '@/workflows/tracking'
import type { createFrontendExecution } from '@/workflows/execution'
import { extensionQueries } from '@/extensions/queries'
import type {
  FrontendContributions,
  ExtensionMenu,
  ExtensionView,
} from '@/extensions/sdk'

const storageKey = (owner: string, key: string) =>
  `unhussle.extension.${owner}.${key}`

/** Frontend host plus the menu/view store the sidebar and router render. */
export function createFrontendExtensions(
  execution: ReturnType<typeof createFrontendExecution>,
  storage?: SessionStorage,
) {
  const requireStorage = () => {
    if (!storage) throw new Error('Extension settings need browser storage')
    return storage
  }
  const menus = new Map<string, ExtensionMenu>()
  const views = new Map<string, ExtensionView>()
  const listeners = new Set<() => void>()
  // useSyncExternalStore needs a stable snapshot between changes.
  let snapshot = { menus: [] as ExtensionMenu[], views: [] as ExtensionView[] }

  const notify = () => {
    snapshot = { menus: [...menus.values()], views: [...views.values()] }
    for (const listener of listeners) listener()
  }

  const host = createExtensionHost<
    FrontendContributions,
    { trace?: SpanScope }
  >({
    registry: execution.registry,
    execute: (id, input, meta) => execution.commands.execute(id, input, meta),
    invoke: execution.commands.invoke,
    queries: extensionQueries(execution),
    // Results belong to the query coordinator; extensions get copies.
    detach: (value) => structuredClone(value),
    telemetry: execution.telemetry,
    on: (name, listener) =>
      execution.events.on(name, (_name, payload) => listener(payload)),
    settings: {
      get: async (owner, key) => {
        const value = requireStorage().getItem(storageKey(owner, key))
        return value === null ? undefined : (JSON.parse(value) as JsonValue)
      },
      set: async (owner, key, value) => {
        requireStorage().setItem(storageKey(owner, key), JSON.stringify(value))
      },
    },
    logger: execution.logger,
    extra: (scope) => {
      const register = <T extends { id: string }>(
        map: Map<string, T>,
        item: T,
      ) => {
        scope.check()
        scope.assertId(item.id)
        if (map.has(item.id))
          throw new Error(`Duplicate contribution: ${item.id}`)
        const value = { ...item }
        map.set(item.id, value)
        notify()
        return scope.own(() => {
          map.delete(item.id)
          notify()
        })
      }
      return {
        menus: { register: (menu) => register(menus, menu) },
        views: { register: (view) => register(views, view) },
      }
    },
  })
  return {
    register: host.register,
    dispose: () => {
      host.dispose()
      listeners.clear()
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
