import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { TimerDisplay } from '@/components/ui/custom/TimerDisplay'
import { useTrackingSession } from '@/workflows/hooks'
import { startTask, pauseTask } from '@/workflows/taskCommands'
import { getNowMillis } from '@c/datetimeUtils'
import { Logger } from '@c/Logger'
import { Play, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

type TaskTimerProps = React.ComponentProps<'div'> & {
  taskId: string
  initialSpentMinutes?: number
}

export const TaskTimerComponent = ({
  taskId,
  initialSpentMinutes = 0,
  ref,
}: TaskTimerProps) => {
  const session = useTrackingSession()
  const isActive = session?.taskId === taskId
  const [now, setNow] = useState(getNowMillis)
  const [isSubmitting, setIsSubmitting] = useState(false)
  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(() => setNow(getNowMillis()), 1000)
    return () => clearInterval(interval)
  }, [isActive])
  const sessionSeconds =
    isActive && session
      ? Math.max(
          0,
          Math.floor(
            (Math.max(now, session.startTime) - session.startTime) / 1000,
          ),
        )
      : 0
  const totalSeconds = initialSpentMinutes * 60 + sessionSeconds
  const handleToggle = async () => {
    setIsSubmitting(true)
    try {
      await (isActive ? pauseTask(taskId) : startTask(taskId))
    } catch (error) {
      Logger.getInstance().error(
        `Failed to change task timer: ${String(error)}`,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div ref={ref} className="flex items-center gap-3">
      <TimerDisplay
        seconds={totalSeconds}
        size="sm"
        className={cn(isActive ? 'text-sage' : 'text-muted')}
      />

      <Button
        variant={isActive ? 'destructive' : 'secondary'}
        size="icon"
        className={cn('h-8 w-8 rounded-full', isActive && 'animate-pulse')}
        onClick={handleToggle}
        disabled={isSubmitting}
        title={isActive ? 'Stop Timer' : 'Start Timer'}
      >
        {isActive ? (
          <Square size={12} fill="currentColor" />
        ) : (
          <Play size={12} fill="currentColor" />
        )}
      </Button>
    </div>
  )
}
