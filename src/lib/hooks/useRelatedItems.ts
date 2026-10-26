import { dependencies } from '@/workflows/runtime'
import type { HydratedTask } from '@c/types/Hydrated'
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

export function useTaggedItems(id: string) {
  return useWorkflowQuery({
    key: `tagged:tags:${id}`,
    dependencies: ['tags', 'urls', 'tasks', 'projects', 'areas', 'goals'],
    load: () => TagsService.getInstance().fetchItems(id),
  })
}
