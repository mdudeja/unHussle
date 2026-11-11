import type { DomainQueries } from '@c/extensions/sdk'
import type { EntryKind, EntryRecord } from '@c/workflows/contracts'
import { fetchReferences, fetchContainerDetail } from '@/services/readModels'
import { fetchTaskContext } from '@/services/taskContext'
import {
  dependencies,
  type createFrontendExecution,
} from '@/workflows/execution'

const MAX_LIST_LIMIT = 100

/** Extension reads share the query coordinator's cache and invalidation. */
export function extensionQueries(
  execution: ReturnType<typeof createFrontendExecution>,
): DomainQueries {
  const { queries, services, ensureList, defineDetail } = execution
  const read = <T>(key: string, kind: EntryKind, load: () => Promise<T>) => {
    queries.define({ key, dependencies: dependencies(kind), load })
    return queries.ensure<T>(key)
  }
  return {
    list: (kind, page = 1, limit) =>
      limit === undefined
        ? ensureList(kind, page)
        : read(`list:${kind}:${page}:${limit}`, kind, () =>
            services[kind].fetchPaginated(
              page,
              Math.max(1, Math.min(limit, MAX_LIST_LIMIT)),
            ),
          ),
    get: (kind, id) => queries.ensure<EntryRecord>(defineDetail(kind, id)),
    references: (kind, options) =>
      read(`references:${kind}:${JSON.stringify(options ?? {})}`, kind, () =>
        fetchReferences(kind, options),
      ),
    container: (kind, id, options) =>
      read(`related:${kind}:${id}:${JSON.stringify(options ?? {})}`, kind, () =>
        fetchContainerDetail(kind, id, options),
      ),
    taskContext: (id) =>
      read(`context:tasks:${id}`, 'tasks', () => fetchTaskContext(id)),
  }
}
