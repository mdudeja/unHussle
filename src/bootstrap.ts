import type { StoreApi } from 'zustand/vanilla'
import type { StoreState } from '@/store'
import { createFrontendExecution } from '@/workflows/execution'
import { createFrontendExtensions } from '@/extensions/application'
import { createExtensionLoader } from '@/extensions/loader'
export { dependencies } from '@/workflows/execution'
export type { EntryTransport } from '@/workflows/contracts'

/** Application composition root; the executor has no dependency on the extension host. */
export function createFrontendRuntime(
  ...args: Parameters<typeof createFrontendExecution>
) {
  const execution = createFrontendExecution(...args)
  const extensions = createFrontendExtensions(
    execution,
    args[1]?.storage ??
      (typeof localStorage === 'undefined' ? undefined : localStorage),
  )
  return {
    ...execution,
    extensions,
    extensionLoader: createExtensionLoader(extensions.register),
    dispose: () => {
      extensions.dispose()
      execution.dispose()
    },
  }
}

export type FrontendRuntime = ReturnType<typeof createFrontendRuntime>
let instances = new WeakMap<StoreApi<StoreState>['getState'], FrontendRuntime>()
const liveInstances = new Set<FrontendRuntime>()

export function getFrontendRuntime(store: StoreApi<StoreState>) {
  let runtime = instances.get(store.getState)
  if (!runtime) {
    runtime = createFrontendRuntime(store)
    instances.set(store.getState, runtime)
    liveInstances.add(runtime)
  }
  return runtime
}

export function disposeFrontendRuntimes() {
  for (const runtime of liveInstances) runtime.dispose()
  liveInstances.clear()
  instances = new WeakMap()
}

if (import.meta.hot) import.meta.hot.dispose(disposeFrontendRuntimes)
