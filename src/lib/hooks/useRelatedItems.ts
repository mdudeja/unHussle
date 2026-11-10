import { dependencies } from '@/workflows/runtime'
import { useWorkflowQuery, useWorkflowRuntime } from '@/workflows/hooks'
import { fetchContainerDetail } from '@/services/readModels'
import type { ReadContainerKind, TaskPageOptions } from '@c/types/readModels'

export function useContainerDetail(
  kind: ReadContainerKind,
  id: string,
  options: TaskPageOptions = {},
) {
  const { queries } = useWorkflowRuntime()
  const key = `related:${kind}:${id}:${JSON.stringify(options)}`
  const query = useWorkflowQuery({
    key,
    dependencies: [
      ...new Set([
        ...dependencies(kind),
        'tasks',
        'projects',
        'areas',
        'goals',
        'resources',
        'tags',
        'urls',
      ] as const),
    ],
    load: () => fetchContainerDetail(kind, id, options),
  })
  return {
    ...query,
    retry: () => {
      queries.markStale(key)
      return queries.ensure(key)
    },
  }
}
