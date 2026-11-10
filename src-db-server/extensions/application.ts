import { createExtensionHost } from '@c/extensions/host'
import type {
  ApplicationServices,
  AtomicContributions,
} from '@c/extensions/sdk'
import type { AppEvents } from '@c/workflows/contracts'
import type { UnHussleDB } from '@d/database/UnHussleDB'
import type {
  createBackendExecution,
  BackendExecution,
} from '@d/workflows/execution'
import { extensionQueries } from './queries'
import { extensionSettings } from './settings'

/** Application capabilities supplied to an optional extension scope. No command proxies. */
export function createBackendExtensions(
  database: UnHussleDB,
  execution: ReturnType<typeof createBackendExecution>,
) {
  const queries = extensionQueries(database)
  const { registry, atomicBoundary, context, telemetry } = execution
  return createExtensionHost<
    ApplicationServices,
    AtomicContributions,
    BackendExecution
  >({
    registry,
    execute: (id, input) => execution.commands.invoke(id, input),
    telemetry,
    services: (scope, trace) => ({
      queries: {
        list: (...args) => {
          scope.check()
          return queries.list(...args)
        },
        get: (...args) => {
          scope.check()
          return queries.get(...args)
        },
        references: (...args) => {
          scope.check()
          return queries.references(...args)
        },
        container: (...args) => {
          scope.check()
          return queries.container(...args)
        },
        taskContext: (...args) => {
          scope.check()
          return queries.taskContext(...args)
        },
      },
      execute: (id, input) => {
        scope.check()
        return execution.commands.execute(id, input, {
          traceId: trace?.traceId,
          parentId: trace?.spanId,
        })
      },
    }),
    on: (name, listener) =>
      execution.events.on(name as keyof AppEvents, (_name, payload) =>
        listener(payload),
      ),
    settings: extensionSettings(database),
    log: (owner, message, error) =>
      error === undefined
        ? context.logger.info(`[${owner}] ${message}`)
        : context.logger.error(`[${owner}] ${message}`, { error }),
    extra: (scope, registrations) => ({
      atomic: {
        action: (action, options) =>
          registrations.action(
            {
              ...action,
              execution: 'atomic',
              run: (input, { domain, trace }) => {
                scope.check()
                if (!domain)
                  throw new Error('Atomic actions require a transaction')
                /** Runs the configured action using the current input and domain. */
                const run = () => action.run(input, domain)
                return trace && telemetry
                  ? telemetry.span('action', action.id, run, {
                      traceId: trace.traceId,
                      parentId: trace.spanId,
                      attrs: { extension: scope.id },
                    })
                  : run()
              },
            },
            options,
          ),
        command: (definition, options) =>
          registrations.command(definition, options, atomicBoundary),
        execute: async (id, input) => {
          scope.check()
          scope.assertId(id)
          if (!registry.kind(id)) throw new Error(`Missing command: ${id}`)
          if (registry.boundary(id) !== atomicBoundary.id)
            throw new Error(`Not an atomic command: ${id}`)
          return execution.commands.invoke(id, input)
        },
      },
    }),
  })
}
