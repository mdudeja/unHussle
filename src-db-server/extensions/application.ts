import { createExtensionHost } from '@c/extensions/host'
import type { AtomicContributions } from '@c/extensions/sdk'
import type { UnHussleDB } from '@d/database/UnHussleDB'
import type {
  createBackendExecution,
  BackendExecution,
} from '@d/workflows/execution'
import { extensionQueries } from '@d/extensions/queries'
import { extensionSettings } from '@d/extensions/settings'
import { AppEvents } from '@c/workflows/contracts'

export function createBackendExtensions(
  database: UnHussleDB,
  execution: ReturnType<typeof createBackendExecution>,
) {
  const { registry, atomicBoundary } = execution
  return createExtensionHost<AtomicContributions, BackendExecution>({
    registry,
    execute: (id, input, meta) => execution.commands.execute(id, input, meta),
    invoke: execution.commands.invoke,
    queries: extensionQueries(database),
    telemetry: execution.telemetry,
    on: (name, listener) =>
      execution.events.on(name as keyof AppEvents, (_name, payload) =>
        listener(payload),
      ),
    settings: extensionSettings(database),
    logger: execution.context.logger,
    extra: (_scope, registrations) => ({
      atomic: {
        actions: {
          register: (action) =>
            registrations.action({
              ...action,
              execution: 'atomic',
              run: (input, { domain }) => {
                if (!domain)
                  throw new Error('Atomic actions require a transaction')
                return action.run(input, domain)
              },
            }),
        },
        commands: {
          register: (definition) => {
            if (definition.execution === 'workflow')
              throw new Error('Atomic commands cannot be workflows')
            return registrations.command(definition, atomicBoundary)
          },
        },
      },
    }),
  })
}
