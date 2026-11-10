import type { MutationResult, EntryRecord } from '@c/workflows/contracts'
import { createBackendKernel } from './kernel'
import { registerMutationCommands } from './registerMutations'
import { registerStatefulCommands } from './registerStateful'
import { createDomainBoundary } from './domainBoundary'
export type { BackendExecution } from './kernel'

/** Creates a backend execution environment that composes the kernel, command registries, runtime, domain boundary, workflow execution, and hydration support for handling backend mutations. */
export function createBackendExecution(
  ...args: Parameters<typeof createBackendKernel>
) {
  const kernel = createBackendKernel(...args)
  const { runtime, registry: compositions, context } = kernel
  registerMutationCommands(kernel)
  registerStatefulCommands(kernel)
  return {
    ...runtime,
    registry: compositions,
    atomicBoundary: createDomainBoundary(kernel),
    context,

    vault: context.vault,
    /** Hydrates a committed mutation result by loading the persisted entity so callers receive the fully hydrated record. */
    hydrate: async <T>(
      result: MutationResult,
      read: (id: string) => Promise<T | null>,
    ) => {
      try {
        const hydrated = await read((result as EntryRecord).id)
        if (!hydrated) throw new Error('Committed entity could not be loaded')
        return hydrated
      } catch (error) {
        context.logger.error(
          'Post-commit hydration failed; write must not be retried automatically',
          { error },
        )
        throw error
      }
    },
  }
}
