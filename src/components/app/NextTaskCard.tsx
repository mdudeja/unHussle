import { useState } from 'react'
import { Link } from 'react-router'
import { Play, Coffee, Check, Pause, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { nextTask } from '@c/scheduler/engine'
import { ProgressStatus } from '@c/types'
import { formatTimeDuration } from '@c/datetimeUtils'
import {
  useTodayPlan,
  useSchedulerAction,
  useSchedulerClock,
} from '@/workflows/schedulerHooks'
import type { PlanEntry } from '@c/scheduler/contracts'
import { useWorkflowRuntime } from '@/workflows/hooks'
import { startTask, pauseTask, completeTask } from '@/workflows/taskCommands'
import { TaskTimerComponent } from './TaskTimer'
import { useStore } from '@/store'

/** Ticks every second on its own, so the card itself re-renders per minute. */
const OccurrenceTimer = ({
  spentMinutes,
  startedAt,
}: Pick<PlanEntry, 'spentMinutes' | 'startedAt'>) => {
  const { now } = useSchedulerClock(1000)
  return (
    <span className="self-center text-sm tabular-nums">
      {formatTimeDuration(
        Math.floor(
          spentMinutes * 60 +
            (startedAt ? Math.max(0, now - startedAt) / 1000 : 0),
        ),
      )}
    </span>
  )
}

export const NextTaskCardComponent = () => {
  const {
    data: plan,
    isLoading,
    error: loadError,
    now,
    date,
    timezone,
    tomorrow,
    generationError,
    refresh,
  } = useTodayPlan()
  const runtime = useWorkflowRuntime()
  const { run, busy, error } = useSchedulerAction()
  const [bypass, setBypass] = useState<string>()
  const [showDeferral, setShowDeferral] = useState(false)
  const [until, setUntil] = useState('')
  const selection = plan?.saved ? nextTask(plan, now, bypass) : null
  const item = selection?.item
  const active = item?.status === 'in_progress'
  const replan = (cue: 'fresh' | 'break' | 'wrap' | 'more') =>
    run(async () => {
      await runtime.commands.execute('scheduler.replan', {
        date,
        timezone,
        revision: plan?.revision,
        cue,
      })
      setBypass(undefined)
    })
  const transition = (status: ProgressStatus) =>
    run(async () => {
      if (!item) return
      if (item.occurrenceId)
        await runtime.commands.execute('occurrence.transition', {
          id: item.occurrenceId,
          status,
        })
      else
        await (status === ProgressStatus.IN_PROGRESS
          ? startTask(item.taskId)
          : status === ProgressStatus.PAUSED
            ? pauseTask(item.taskId)
            : completeTask(item.taskId))
      setBypass(undefined)
    })
  const adjust = (action: 'later' | 'defer') =>
    run(async () => {
      if (!item) return
      await runtime.commands.execute('scheduler.adjust', {
        date,
        timezone,
        revision: plan?.revision,
        itemId: item.id,
        action,
        ...(action === 'defer' ? { until: until || tomorrow } : {}),
      })
      setShowDeferral(false)
      setBypass(undefined)
    })
  return (
    <Card className="w-full max-w-2xl mx-auto border-primary/30">
      <CardHeader>
        <div className="flex justify-between items-center gap-4">
          <span className="text-sm text-muted-foreground">
            {active ? 'Current focus' : 'Next up'}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => replan('fresh')}
          >
            <RefreshCw className="size-4 mr-2" />
            Reschedule
          </Button>
        </div>
        <CardTitle className="text-2xl">
          {item?.title ??
            (isLoading || !plan?.saved
              ? 'Preparing your stack…'
              : 'A little breathing room')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {(error || loadError || generationError) && (
          <div role="alert" className="space-y-2">
            <p>{error || loadError || generationError}</p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await runtime.commands.execute('scheduler.generate', {
                    date,
                    timezone,
                  })
                  await refresh()
                })
              }
            >
              Try again
            </Button>
          </div>
        )}
        {selection?.upcoming && (
          <p className="text-sm text-muted-foreground">
            Upcoming: {selection.upcoming.title} at{' '}
            {new Date(selection.upcoming.fixedStart ?? now).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
        {item ? (
          <>
            <div className="flex gap-2 flex-wrap">
              {item.isQuick && <Badge variant="secondary">Quick</Badge>}
              {item.isFun && <Badge variant="secondary">Fun</Badge>}
              {item.isChore && <Badge variant="outline">Chore</Badge>}
              {item.occurrenceId && <Badge variant="outline">Recurring</Badge>}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                disabled={busy}
                onClick={() =>
                  transition(
                    active ? ProgressStatus.PAUSED : ProgressStatus.IN_PROGRESS,
                  )
                }
              >
                {active ? (
                  <Pause className="size-4 mr-2" />
                ) : (
                  <Play className="size-4 mr-2" />
                )}
                {active ? 'Pause' : 'Start'}
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => transition(ProgressStatus.COMPLETED)}
              >
                <Check className="size-4 mr-2" />
                Done
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  useStore.getState().openEditor('tasks', item.taskId)
                }
              >
                Details
              </Button>
              {active && !item.occurrenceId && (
                <TaskTimerComponent
                  taskId={item.taskId}
                  initialSpentMinutes={item.spentMinutes}
                />
              )}
              {active && item.occurrenceId && (
                <OccurrenceTimer
                  spentMinutes={item.spentMinutes}
                  startedAt={item.startedAt}
                />
              )}
            </div>
            {!active && (
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => setBypass(item.id)}
                >
                  Do something else
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy || item.fixedStart !== null}
                  onClick={() => adjust('later')}
                >
                  Later today
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy || item.fixedStart !== null}
                  onClick={() => setShowDeferral(!showDeferral)}
                >
                  {item.occurrenceId ? 'Skip this occurrence' : 'Another day'}
                </Button>
              </div>
            )}
            {showDeferral && (
              <div className="flex items-end gap-2 flex-wrap">
                <div>
                  <Label htmlFor="defer-until">
                    {item.occurrenceId
                      ? 'Future occurrences will stay in place'
                      : 'Available again on'}
                  </Label>
                  {!item.occurrenceId && (
                    <Input
                      id="defer-until"
                      type="date"
                      min={tomorrow}
                      value={until || tomorrow}
                      onChange={(e) => setUntil(e.target.value)}
                    />
                  )}
                </div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => adjust('defer')}
                >
                  Confirm
                </Button>
              </div>
            )}
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer">Why this task?</summary>
              <p className="mt-2">{item.reason}</p>
            </details>
          </>
        ) : (
          plan?.saved && (
            <div className="space-y-3">
              <Coffee className="size-8 text-primary" />
              <p className="text-sm text-muted-foreground">
                {selection?.upcoming
                  ? 'There is no suitable task before your next appointment.'
                  : bypass
                    ? 'No other task is ready right now.'
                    : plan.entries.some((i) =>
                          ['planned', 'paused'].includes(i.status),
                        )
                      ? 'Your remaining tasks will be available later.'
                      : plan.backlogCount > 0
                        ? 'Other tasks remain, but none fit this stack’s capacity or constraints.'
                        : plan.entries.length === 0
                          ? 'No tasks are ready yet. Capture something below whenever you like.'
                          : 'You’ve reached the end of this stack.'}
              </p>
              {bypass && (
                <Button variant="outline" onClick={() => setBypass(undefined)}>
                  Show suggestion again
                </Button>
              )}
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => replan('more')}
              >
                Add more
              </Button>
            </div>
          )
        )}
        <div className="flex gap-2 flex-wrap border-t pt-4">
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || active}
            onClick={() => replan('break')}
          >
            Taking a break
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || active}
            onClick={() => replan('wrap')}
          >
            Wrapping up
          </Button>
        </div>
        {plan?.entries.some(
          (i) =>
            i.fixedEnd !== null &&
            i.fixedEnd < now &&
            ['planned', 'paused'].includes(i.status),
        ) && (
          <details className="text-sm">
            <summary className="cursor-pointer">
              An earlier appointment needs a decision
            </summary>
            <div className="mt-2 space-y-2">
              {plan.entries
                .filter(
                  (i) =>
                    i.fixedEnd !== null &&
                    i.fixedEnd < now &&
                    ['planned', 'paused'].includes(i.status),
                )
                .map((i) => (
                  <Button
                    key={i.id}
                    variant="link"
                    className="h-auto px-0"
                    onClick={() =>
                      useStore.getState().openEditor('tasks', i.taskId)
                    }
                  >
                    {i.title}
                  </Button>
                ))}
            </div>
          </details>
        )}
        {plan?.stale && (
          <p className="text-xs text-muted-foreground">
            Task details have changed. Reschedule whenever you want a fresh
            stack.
          </p>
        )}
        {!!plan?.conflicts.length && (
          <details className="text-sm">
            <summary>
              {plan.conflicts.length} planning consideration
              {plan.conflicts.length === 1 ? '' : 's'}
            </summary>
            <ul className="mt-2 list-disc pl-5">
              {plan.conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </details>
        )}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <Link to="/day">Day view</Link>
          <Link to="/week">Week view</Link>
          <Link to="/scheduler/settings">Preferences</Link>
        </div>
      </CardContent>
    </Card>
  )
}
