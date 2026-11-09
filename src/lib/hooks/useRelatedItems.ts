import { dependencies } from '@/workflows/runtime'
import type { HydratedTask } from '@c/types/Hydrated'
import { UrlsService } from '@/services/database/UrlsService'
import { TagsService } from '@/services/database/TagsService'
import { useWorkflowQuery, useWorkflowRuntime } from '@/workflows/hooks'

export function useRelatedTasks(
  kind: 'areas' | 'projects' | 'goals',
  id: string,
) {
  const runtime = useWorkflowRuntime()
  return useWorkflowQuery({
    key: `related:${kind}:${id}`,
    dependencies: dependencies(kind),
    load: async () => {
      const parent = await runtime.services[kind].fetchById(id)
      return (parent.tasks ?? []) as HydratedTask[]
    },
  })
}

export function useSupporterItems(kind: 'tags' | 'urls', id: string) {
  return useWorkflowQuery({
    key: `tagged:${kind}:${id}`,
    dependencies: [
      'tags',
      'urls',
      'tasks',
      'projects',
      'areas',
      'goals',
      'resources',
    ],
    load: () =>
      (kind === 'tags'
        ? TagsService.getInstance()
        : UrlsService.getInstance()
      ).fetchItems(id),
  })
}
