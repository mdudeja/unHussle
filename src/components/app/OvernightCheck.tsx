import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DateTimePicker } from '@/components/ui/custom/DateTimePicker'

/**
 * Asks about work that kept running since an earlier day instead of counting
 * the whole night: the user may have worked through it, or simply forgot.
 */
export const OvernightCheck = ({
  startedAt,
  suggestedStop,
  busy,
  stillWorkingLabel,
  onStillWorking,
  onStopped,
}: {
  startedAt: number
  /** Where the "I stopped at" picker starts. */
  suggestedStop: number
  busy: boolean
  stillWorkingLabel: string
  onStillWorking: () => void
  onStopped: (at: number) => void
}) => {
  const [stoppedAt, setStoppedAt] = useState<number | undefined>(suggestedStop)
  const since = new Date(startedAt).toLocaleString([], {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <div className="space-y-3 rounded-md bg-muted px-3 py-3 text-sm">
      <p>
        This has been running since {since}. Still on it, or did you stop at
        some point?
      </p>
      <div className="flex gap-2 flex-wrap items-center">
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={onStillWorking}
        >
          {stillWorkingLabel}
        </Button>
        <span className="text-muted-foreground">or I stopped at</span>
        <DateTimePicker
          size="sm"
          value={stoppedAt}
          onChange={setStoppedAt}
          disabled={busy}
        />
        <Button
          size="sm"
          disabled={busy || stoppedAt === undefined}
          onClick={() => stoppedAt !== undefined && onStopped(stoppedAt)}
        >
          Save
        </Button>
      </div>
    </div>
  )
}
