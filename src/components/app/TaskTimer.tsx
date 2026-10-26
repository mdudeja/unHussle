import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { TimerDisplay } from '@/components/ui/custom/TimerDisplay'
import { timeTrackingService } from '@/services/TimeTrackingService'
import { Play, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

type TaskTimerProps = React.ComponentProps<'div'> & {
  taskId: string
  initialSpentMinutes?: number
  onTimerStop?: () => void
}

export const TaskTimerComponent = ({
  taskId,
  initialSpentMinutes = 0,
  onTimerStop,
  ref,
}: TaskTimerProps) => {
  // Resume if we are currently tracking this task (callers key by taskId)
  const [isActive, setIsActive] = useState(
    () => timeTrackingService.getActiveTracking()?.taskId === taskId,
  )
  const [sessionSeconds, setSessionSeconds] = useState(() => {
    const active = timeTrackingService.getActiveTracking()
    if (active?.taskId !== taskId) return 0
    // Calculate initial elapsed time since start
    return Math.floor((Date.now() - active.startTime) / 1000)
  })

  // Timer tick effect
  useEffect(() => {
    let interval: Timer | null = null

    if (isActive) {
      interval = setInterval(() => {
        setSessionSeconds((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isActive])

  const handleToggle = async () => {
    if (isActive) {
      await timeTrackingService.stopTracking()
      setIsActive(false)
      setSessionSeconds(0)
      if (onTimerStop) onTimerStop()
    } else {
      await timeTrackingService.startTracking(taskId)
      setIsActive(true)
    }
  }

  // Calculate total seconds (historical + current session)
  // initialSpentMinutes is in minutes, convert to seconds
  const totalSeconds = initialSpentMinutes * 60 + sessionSeconds

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
