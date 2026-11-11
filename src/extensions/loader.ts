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

type Register = (id: string, extension: FrontendExtension) => Disposable
type Load = (url: string) => Promise<{ default?: FrontendExtension }>

/** Keeps loaded frontend entries in step with the server's extension list. */
export function createExtensionLoader(
  register: Register,
  load: Load = (url) => import(/* @vite-ignore */ url),
) {
  const active = new Map<string, Disposable>()
  const pending = new Set<string>()
  const listeners = new Set<() => void>()
  let wanted = new Set<string>()
  let errors: Record<string, string> = {}
  // A reset makes imports that are still in flight stale.
  let generation = 0

  const setError = (id: string, error?: string) => {
    const { [id]: _previous, ...rest } = errors
    errors = error ? { ...rest, [id]: error } : rest
    for (const listener of listeners) listener()
  }

  const start = async (id: string) => {
    const started = generation
    pending.add(id)
    try {
      const extension = (await load(extensionService.frontendUrl(id))).default
      if (typeof extension?.activate !== 'function')
        throw new Error('The frontend entry must default-export { activate }')
      if (started === generation && wanted.has(id) && !active.has(id))
        active.set(id, register(id, extension))
      setError(id)
    } catch (error) {
      setError(id, error instanceof Error ? error.message : String(error))
      Logger.getInstance().error(`Extension ${id} failed to load`, { error })
    } finally {
      pending.delete(id)
    }
  }

  const stop = (id: string) => {
    active.get(id)?.()
    active.delete(id)
  }

  return {
    sync: (extensions: InstalledExtension[]) => {
      wanted = new Set(
        extensions
          .filter(
            (e) => e.enabled && e.status === 'active' && e.manifest?.frontend,
          )
          .map((e) => e.manifest!.id),
      )
      for (const id of [...active.keys()]) if (!wanted.has(id)) stop(id)
      for (const id of Object.keys(errors)) if (!wanted.has(id)) setError(id)
      return Promise.all(
        [...wanted]
          .filter((id) => !active.has(id) && !pending.has(id))
          .map(start),
      )
    },
    /** Unloads everything, so the next sync imports fresh code. */
    reset: () => {
      generation++
      pending.clear()
      for (const id of [...active.keys()]) stop(id)
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
