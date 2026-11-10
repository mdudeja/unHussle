import { ProgressStatus } from '@c/types/enums'

export const pendingStatuses = [
  ProgressStatus.PLANNED,
  ProgressStatus.PAUSED,
  ProgressStatus.IN_PROGRESS,
]
const pending = new Set<string>(pendingStatuses)
/** Determines whether a status is considered pending. */
export const isPending = (status: string) => pending.has(status)
