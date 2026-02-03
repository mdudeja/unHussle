import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useStore } from '@/store'
import { ProgressStatus, Priority } from '@c/types/index'
import { Play, Coffee } from 'lucide-react'
import { TaskTimerComponent } from '@/components/app/TaskTimer'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export const NextTaskCardComponent = ({ ref }: React.ComponentProps<'div'>) => {
  const { tasks, projects, areas } = useStore()

  const nextTask = useMemo(() => {
    if (tasks.isLoading || !tasks.data) return null

    // 1. Check for Active (In Progress) task
    const activeTask = tasks.data.find(
      (t) => t.status === ProgressStatus.IN_PROGRESS,
    )
    if (activeTask) return activeTask

    // 2. Find highest priority Planned task
    // Sort by Priority (High > Medium > Low) then Created At
    const plannedTasks = tasks.data.filter(
      (t) => t.status === ProgressStatus.PLANNED,
    )

    // Map priority to numeric value for sorting
    const getPriorityVal = (p: Priority | null) => {
      if (p === Priority.HIGH) return 3
      if (p === Priority.MEDIUM) return 2
      return 1
    }

    if (plannedTasks.length === 0) return null

    return plannedTasks.sort((a, b) => {
      const pA = getPriorityVal(a.priority)
      const pB = getPriorityVal(b.priority)
      if (pA !== pB) return pB - pA
      return a.created_at - b.created_at // Oldest first
    })[0]
  }, [tasks.data])

  const contextName = useMemo(() => {
    if (!nextTask) return null
    if (nextTask.project_id) {
      return projects.data.find((p) => p.id === nextTask.project_id)?.title
    }
    if (nextTask.area_id) {
      return areas.data.find((a) => a.id === nextTask.area_id)?.title
    }
    return null
  }, [nextTask, projects.data, areas.data])

  if (tasks.isLoading) {
    return (
      <Card className="w-full max-w-2xl mx-auto border-dashed animate-pulse bg-surface/20">
        <CardHeader>
          <div className="h-6 w-32 bg-muted rounded"></div>
        </CardHeader>
        <CardContent className="h-24"></CardContent>
      </Card>
    )
  }

  if (!nextTask) {
    return (
      <Card className="w-full max-w-2xl mx-auto border-primary/30 shadow-accent">
        <CardContent className="flex flex-col items-center justify-center p-8 text-primary gap-4">
          <div className="p-4 rounded-full border border-primary/30 shadow-md">
            <Coffee className="size-8 text-primary" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-medium text-text">All caught up!</h3>
            <p className="text-sm">
              Enjoy your free time, or capture something new.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const isHighPriority = nextTask.priority === Priority.HIGH

  return (
    <Card
      ref={ref}
      className={cn(
        'w-full max-w-2xl mx-auto border-primary/30 shadow-accent',
        isHighPriority
          ? 'border-l-8 border-l-primary'
          : 'border-l-8 border-l-accent',
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <span className="text-sm uppercase tracking-wider font-semibold text-primary animate-bounce-short">
            {nextTask.status === ProgressStatus.IN_PROGRESS
              ? 'Current Focus'
              : 'Next Up'}
          </span>
          {contextName && (
            <Badge variant="outline" className="font-normal">
              {contextName}
            </Badge>
          )}
        </div>
        <CardTitle className="text-2xl font-bold leading-tight mt-1">
          {nextTask.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 flex items-center justify-between">
        <div className="flex gap-2">
          {nextTask.is_quick && (
            <Badge variant="secondary" className="text-xs">
              Quick
            </Badge>
          )}
          {nextTask.is_fun && (
            <Badge
              variant="secondary"
              className="text-xs bg-sage/20 text-sage hover:bg-sage/20 border-sage/20"
            >
              Fun
            </Badge>
          )}
          {nextTask.is_chore && (
            <Badge variant="outline" className="text-xs">
              Chore
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4">
          {nextTask.status === ProgressStatus.IN_PROGRESS ? (
            <div className="flex items-center gap-3 bg-accent/20 px-4 py-2 rounded-lg border border-border/50">
              <TaskTimerComponent
                taskId={nextTask.id}
                initialSpentMinutes={nextTask.spent_minutes}
              />
            </div>
          ) : (
            <Button
              size="lg"
              className={cn(
                'gap-2 shadow-sm font-semibold transition-all',
                isHighPriority ? 'bg-danger hover:bg-danger/90 text-white' : '',
              )}
              onClick={async () => {
                // Dynamically import to avoid circular dep if any, though not expected here
                const { timeTrackingService } =
                  await import('@/services/TimeTrackingService')
                await timeTrackingService.startTracking(nextTask.id)
                await tasks.update(nextTask.id, {
                  status: ProgressStatus.IN_PROGRESS,
                })
              }}
            >
              <Play className="size-4 fill-current" />
              Start
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
