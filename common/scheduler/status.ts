import { ProgressStatus } from '@c/types/enums'

export const pendingStatuses = [
  ProgressStatus.PLANNED,
  ProgressStatus.PAUSED,
  ProgressStatus.IN_PROGRESS,
]
const pending = new Set<string>(pendingStatuses)
export const isPending = (status: string) => pending.has(status)
