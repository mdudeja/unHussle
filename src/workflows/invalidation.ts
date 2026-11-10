import type { QueryDependency } from './queries'

/** Announcements precede completion events. Refresh once for their combined dependencies. */
export function createInvalidationBatcher(
  refresh: (
    operationId: string,
    dependencies: QueryDependency[],
  ) => Promise<void>,
  {
    isPending = () => false,
  }: { isPending?: (operationId: string) => boolean } = {},
) {
  const pending = new Map<
    string,
    { dependencies: Set<QueryDependency>; timer: ReturnType<typeof setTimeout> }
  >()
  // Bound replay deduplication; operation IDs are unique per committed write.
  const completed = new Map<string, Set<QueryDependency>>()
  let disposed = false

  /** Immediately flushes a pending operation, refreshing any dependencies that have not already been handled. */
  const flush = async (operationId: string) => {
    const entry = pending.get(operationId)
    if (!entry || disposed) return
    clearTimeout(entry.timer)
    pending.delete(operationId)
    const seen = completed.get(operationId) ?? new Set<QueryDependency>()
    const dependencies = [...entry.dependencies].filter(
      (dependency) => !seen.has(dependency),
    )
    for (const dependency of dependencies) seen.add(dependency)
    completed.set(operationId, seen)
    if (completed.size > 500) completed.delete(completed.keys().next().value!)
    if (dependencies.length) await refresh(operationId, dependencies)
  }

  return {
    /** Marks an operation and its dependent queries as invalid so they will be
     * refreshed, coalescing repeated invalidations until they are flushed */
    async invalidate(
      operationId: string,
      dependencies: QueryDependency[],
      complete = false,
    ) {
      if (disposed) return
      let entry = pending.get(operationId)
      if (!entry) {
        entry = {
          dependencies: new Set(),
          timer: setTimeout(() => {
            if (!isPending(operationId)) void flush(operationId)
          }, 25),
        }
        pending.set(operationId, entry)
      }
      for (const dependency of dependencies) entry.dependencies.add(dependency)
      if (complete) await flush(operationId)
    },
    /** Releases all pending timers and clears internal state, marking this object as disposed so it can no longer be used. */
    dispose() {
      disposed = true
      for (const entry of pending.values()) clearTimeout(entry.timer)
      pending.clear()
      completed.clear()
    },
  }
}
