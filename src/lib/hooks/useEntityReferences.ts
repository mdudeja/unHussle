import { useWorkflowQuery } from '@/workflows/hooks'
import { dependencies } from '@/workflows/runtime'
import { fetchAllReferences } from '@/services/readModels'
import type { EntryKind } from '@c/workflows/contracts'

export function useEntityReferences(kind: EntryKind, enabled = true) {
  const query = useWorkflowQuery(
    {
      key: `references:${kind}`,
      dependencies: dependencies(kind),
      load: () => fetchAllReferences(kind),
    },
    enabled,
  )
  return { ...query, data: query.data ?? [] }
}
