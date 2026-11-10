import { UnHussleDB } from '@d/database/UnHussleDB'
import { createBackendExecution } from '@d/workflows/execution'
import { createBackendExtensions } from '@d/extensions/application'

/** Owns application wiring and disposes contributions before the executor. */
export function createBackendRuntime(
  ...args: Parameters<typeof createBackendExecution>
) {
  const execution = createBackendExecution(...args)
  const extensions = createBackendExtensions(args[0], execution)
  return {
    ...execution,
    extensions,
    dispose: () => {
      extensions.dispose()
      execution.dispose()
    },
  }
}

export const backendRuntime = createBackendRuntime(UnHussleDB.getInstance())
