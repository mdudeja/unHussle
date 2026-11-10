import type { StoreApi } from 'zustand/vanilla'
import type { StoreState } from '@/store'
import type { FrontendEvents } from '@/workflows/contracts'
import { createFrontendExecution } from '@/workflows/execution'
import { createFrontendExtensions } from '@/extensions/application'
export { dependencies } from '@/workflows/execution'
export type { EntryTransport } from '@/workflows/contracts'

/** Application composition root; the executor has no dependency on the extension host. */
export function createFrontendRuntime(
  ...args: Parameters<typeof createFrontendExecution>
) {
  const execution = createFrontendExecution(...args)
  const extensions = createFrontendExtensions({
    registry: execution.registry,
    queries: execution.extensionReads,
    telemetry: execution.telemetry,
    execute: (id, input, meta) => execution.commands.execute(id, input, meta),
    invoke: execution.commands.invoke,
    on: (name, listener) =>
      execution.events.on(name as keyof FrontendEvents, (_name, payload) =>
        listener(payload),
      ),
    storage:
      args[1]?.storage ??
      (typeof localStorage === 'undefined' ? undefined : localStorage),
    logger: execution.logger,
  })
  return {
    ...execution,
    extensions,
    dispose: () => {
      extensions.dispose()
      execution.dispose()
    },
  }
}

export type FrontendRuntime = ReturnType<typeof createFrontendRuntime>
let instances = new WeakMap<StoreApi<StoreState>['getState'], FrontendRuntime>()
const liveInstances = new Set<FrontendRuntime>()

/** Retrieves the shared frontend runtime for a store, creating and registering it when one does not already exist. */
export function getFrontendRuntime(store: StoreApi<StoreState>) {
  let runtime = instances.get(store.getState)
  if (!runtime) {
    runtime = createFrontendRuntime(store)
    instances.set(store.getState, runtime)
    liveInstances.add(runtime)
  }
  return runtime
}

/** Disposes all active frontend runtimes and clears the tracking of live instances. */
export function disposeFrontendRuntimes() {
  for (const runtime of liveInstances) runtime.dispose()
  liveInstances.clear()
  instances = new WeakMap()
}

if (import.meta.hot) import.meta.hot.dispose(disposeFrontendRuntimes)
