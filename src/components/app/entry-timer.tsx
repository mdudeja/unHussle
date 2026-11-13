import { formatTimeDuration } from '@c/datetimeUtils'
import type { PlanEntry } from '@c/scheduler/contracts'
import { useSchedulerClock } from '@/workflows/schedulerHooks'
import { cn } from '@/lib/utils'

const SECOND_MS = 1000

/** Time spent on an entry, ticking every second while it runs. */
export const EntryTimer = ({
  spentMinutes,
  startedAt,
  className,
}: Pick<PlanEntry, 'spentMinutes' | 'startedAt'> & { className?: string }) => {
  const { now } = useSchedulerClock(SECOND_MS)
  return (
    <span className={cn('tabular-nums', className)}>
      {formatTimeDuration(
        Math.floor(
          spentMinutes * 60 +
            (startedAt ? Math.max(0, now - startedAt) / SECOND_MS : 0),
        ),
      )}
    </span>
  )
}
