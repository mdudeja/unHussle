import { createExtensionHost } from '@c/extensions/host'
import type { SpanScope } from '@c/workflows/telemetry'
import type { createFrontendExecution } from '@/workflows/execution'
import { extensionQueries } from '@/extensions/queries'
import { extensionService } from '@/services/extensions'
import type { ExtensionManifest } from '@c/extensions/manifest'
import type { Disposable } from '@c/extensions/sdk'
import type {
  FrontendContributions,
  FrontendExtension,
  ExtensionMenu,
  ExtensionView,
  ProvidedExports,
} from '@/extensions/sdk'

/** The manifest fields that link frontend entries to each other. */
export type ExtensionLinks = Pick<ExtensionManifest, 'requires' | 'exports'>

/** Frontend host plus the menu/view store the sidebar and router render. */
export function createFrontendExtensions(
  execution: ReturnType<typeof createFrontendExecution>,
) {
  const menus = new Map<string, ExtensionMenu>()
  const views = new Map<string, ExtensionView>()
  const listeners = new Set<() => void>()
  const links = new Map<string, ExtensionLinks>()
  const provided = new Map<string, ProvidedExports>()
  // `provide` is only allowed while this extension's `activate` runs.
  let activating: string | null = null
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
    // The server keeps settings per extension, next to backend ones.
    settings: {
      get: (owner, key) => extensionService.getSetting(owner, key),
      set: (owner, key, value) =>
        extensionService.setSetting(owner, key, value),
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
      const { id } = scope
      return {
        menus: { register: (menu) => register(menus, menu) },
        views: { register: (view) => register(views, view) },
        exports: {
          provide: (value) => {
            scope.check()
            if (!links.get(id)?.exports)
              throw new Error(`Add "exports": true to ${id}'s extension.json`)
            if (activating !== id)
              throw new Error('Call api.exports.provide while activating')
            if (provided.has(id))
              throw new Error('api.exports.provide was already called')
            if (!Number.isInteger(value.version) || value.version < 1)
              throw new Error('Exports need a whole version number from 1')
            provided.set(id, value)
            scope.own(() => provided.delete(id))
          },
        },
        dependencies: {
          get: <T extends ProvidedExports>(other: string) => {
            scope.check()
            if (!links.get(id)?.requires?.includes(other))
              throw new Error(`Add "${other}" to ${id}'s requires`)
            const value = provided.get(other)
            if (!value) throw new Error(`${other} is off or provides nothing`)
            return value as T
          },
        },
      }
    },
  })
  /** Starts a frontend entry; one with `exports` must provide them. */
  const register = (
    id: string,
    extension: FrontendExtension,
    linked: ExtensionLinks = {},
  ): Disposable => {
    links.set(id, linked)
    activating = id
    let dispose: Disposable
    try {
      dispose = host.register(id, extension)
    } catch (error) {
      links.delete(id)
      throw error
    } finally {
      activating = null
    }
    if (linked.exports && !provided.has(id)) {
      dispose()
      links.delete(id)
      throw new Error('activate must call api.exports.provide')
    }
    return () => {
      dispose()
      links.delete(id)
    }
  }

  return {
    register,
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
