import { ProgressStatus } from '@c/types'
import type { EntityAction, EntityKind } from './types'
import { CheckCircle2 } from 'lucide-react'
import { getFrontendRuntime } from '@/bootstrap'
import { useStore } from '@/store'

const validStatuses = [
  ProgressStatus.PLANNED,
  ProgressStatus.IN_PROGRESS,
  ProgressStatus.PAUSED,
  ProgressStatus.ON_HOLD,
  ProgressStatus.MIGRATED,
]

export const useCompleteAction = <
  T extends { id: string; status: ProgressStatus | null },
>(
  kind: EntityKind,
): EntityAction<T>[] => {
  return [
    {
      id: 'complete',
      label: 'Complete',
      icon: CheckCircle2,
      variant: 'outline',
      run: async (item) => {
        await getFrontendRuntime(useStore).commands.execute(
          'entityCollection.change',
          {
            kind,
            action: 'update',
            id: item.id,
            changes: { status: ProgressStatus.COMPLETED },
          },
        )
      },
      isVisible: (item) =>
        Boolean(item.status && validStatuses.includes(item.status)),
    },
  ]
}
