import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import * as TypeBox from '@sinclair/typebox'
import {
  SHARED_MODULES_GLOBAL,
  type InstalledExtension,
} from '@c/extensions/manifest'
import type { Disposable } from '@c/extensions/sdk'
import { Logger } from '@c/Logger'
import * as sdk from '@/extensions/sdk'
import type { FrontendExtension } from '@/extensions/sdk'
import type { ExtensionLinks } from '@/extensions/application'
import { extensionService } from '@/services/extensions'

// Bundled frontend entries read their shared imports from this global.
Object.assign(globalThis, {
  [SHARED_MODULES_GLOBAL]: {
    react: React,
    'react/jsx-runtime': jsxRuntime,
    '@sinclair/typebox': TypeBox,
    'unhussle/frontend': sdk,
  },
})

type Register = (
  id: string,
  extension: FrontendExtension,
  links: ExtensionLinks,
) => Disposable
type Load = (url: string) => Promise<{ default?: FrontendExtension }>

/**
 * Keeps loaded frontend entries in step with the server's extension list,
 * which is in dependency order: providers start before what needs them.
 */
export function createExtensionLoader(
  register: Register,
  load: Load = (url) => import(/* @vite-ignore */ url),
) {
  // Each running entry with the links it started with.
  const active = new Map<string, { dispose: Disposable; links: ExtensionLinks }>()
  const pending = new Map<string, Promise<void>>()
  const listeners = new Set<() => void>()
  let wanted = new Map<string, ExtensionLinks>()
  let errors: Record<string, string> = {}
  // A reset makes imports that are still in flight stale.
  let generation = 0

  const setError = (id: string, error?: string) => {
    const { [id]: _previous, ...rest } = errors
    errors = error ? { ...rest, [id]: error } : rest
    for (const listener of listeners) listener()
  }

  /** A required frontend entry that isn't running, after waiting for it. */
  const missingRequirement = async (links: ExtensionLinks) => {
    for (const required of links.requires ?? []) {
      if (!wanted.has(required)) continue
      await pending.get(required)
      if (!active.has(required)) return required
    }
  }

  const run = async (id: string, links: ExtensionLinks) => {
    const started = generation
    try {
      // Waits only for requirements, so other imports start right away.
      const missing = links.requires?.length
        ? await missingRequirement(links)
        : undefined
      if (missing) {
        setError(id, `Needs ${missing}, which failed to load`)
        return
      }
      const extension = (await load(extensionService.frontendUrl(id))).default
      if (typeof extension?.activate !== 'function')
        throw new Error('The frontend entry must default-export { activate }')
      if (started === generation && wanted.has(id) && !active.has(id))
        active.set(id, { dispose: register(id, extension, links), links })
      setError(id)
    } catch (error) {
      setError(id, error instanceof Error ? error.message : String(error))
      Logger.getInstance().error(`Extension ${id} failed to load`, { error })
    }
  }

  const start = (id: string, links: ExtensionLinks) => {
    const running: Promise<void> = run(id, links).finally(() => {
      if (pending.get(id) === running) pending.delete(id)
    })
    pending.set(id, running)
    return running
  }

  /** Stops an entry after what needs it, since they hold its exports. */
  const stop = (id: string) => {
    for (const [other, { links }] of active)
      if (links.requires?.includes(id)) stop(other)
    active.get(id)?.dispose()
    active.delete(id)
  }

  return {
    sync: async (extensions: InstalledExtension[]) => {
      wanted = new Map(
        extensions
          .filter(
            (e) => e.enabled && e.status === 'active' && e.manifest?.frontend,
          )
          .map(({ manifest }) => [
            manifest!.id,
            { requires: manifest!.requires, exports: manifest!.exports },
          ]),
      )
      for (const id of [...active.keys()].reverse())
        if (!wanted.has(id)) stop(id)
      for (const id of Object.keys(errors)) if (!wanted.has(id)) setError(id)
      for (const [id, links] of wanted)
        if (!active.has(id) && !pending.has(id)) void start(id, links)
      await Promise.all(pending.values())
    },
    /** Unloads everything, so the next sync imports fresh code. */
    reset: () => {
      generation++
      pending.clear()
      for (const id of [...active.keys()].reverse()) stop(id)
    },
    errors: {
      snapshot: () => errors,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    },
  }
}
