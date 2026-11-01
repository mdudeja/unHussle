import { useState } from 'react'
import { Link } from 'react-router'
import { Play, Coffee, Check, Pause, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { nextTask } from '@c/scheduler/engine'
import {
  dayModeOf,
  runningSinceEarlierDay,
  windDownOf,
} from '@c/scheduler/dayMode'
import { OvernightCheck } from './OvernightCheck'
import { ProgressStatus } from '@c/types'
import { formatTimeDuration } from '@c/datetimeUtils'
import {
  useTodayPlan,
  useSchedulerAction,
  useSchedulerClock,
  useSkippedTasks,
  useOvernightAnswer,
  overnightKey,
  suggestedStop,
} from '@/workflows/schedulerHooks'
import type { DayModeChange, DayPlan, PlanEntry } from '@c/scheduler/contracts'
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

const timeOf = (millis: number) =>
  new Date(millis).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })

/** Says why the day is wrapping up, so the switch to chores never surprises. */
const wrapMessage = (plan: DayPlan) =>
  plan.wrapReason === 'windDown'
    ? `You usually wind down at ${timeOf(windDownOf(plan))}, so it’s chores from here.`
    : plan.wrapReason === 'lastTask'
      ? 'You’re on your last task, so only chores are left after it.'
      : 'You’re wrapping up, so only chores are left.'

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
  const { skipped, skip, clear: clearSkipped } = useSkippedTasks(date)
  const [showDeferral, setShowDeferral] = useState(false)
  const [until, setUntil] = useState('')
  const selection = plan?.saved ? nextTask(plan, now, skipped) : null
  const mode = plan?.saved ? dayModeOf(plan) : 'normal'
  const onBreak = mode === 'break'
  // On a break the card shows the break; the next task is only a peek.
  const item = onBreak ? undefined : selection?.item
  const active = item?.status === 'in_progress'
  const overnight =
    item && runningSinceEarlierDay(item, date, timezone) ? item : undefined
  const { stillWorking, confirm } = useOvernightAnswer(
    overnight?.startedAt !== undefined
      ? overnightKey(
          overnight.taskId,
          overnight.occurrenceId,
          overnight.startedAt,
        )
      : null,
  )
  const askOvernight = overnight?.startedAt !== undefined && !stillWorking
  const stopAt = (at: number) =>
    run(async () => {
      if (!overnight) return
      await runtime.commands.execute('tracking.stop', {
        taskId: overnight.taskId,
        occurrenceId: overnight.occurrenceId,
        at,
      })
    })
  const replan = (cue: 'fresh' | 'break' | 'wrap' | 'more') =>
    run(async () => {
      await runtime.commands.execute('scheduler.replan', {
        date,
        timezone,
        revision: plan?.revision,
        cue,
      })
      clearSkipped()
    })
  const changeMode = (change: DayModeChange) =>
    run(async () => {
      await runtime.commands.execute('scheduler.mode.change', {
        date,
        timezone,
        change,
      })
      // Starting a break or wrap-up re-plans the stack.
      if (change !== 'endBreak') clearSkipped()
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
    })
  return (
    <Card className="w-full max-w-2xl mx-auto border-primary/30">
      <CardHeader>
        <div className="flex justify-between items-center gap-4">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            {onBreak ? 'Break time' : active ? 'Current focus' : 'Next up'}
            {mode === 'wrap' && <Badge variant="secondary">Wrapping up</Badge>}
          </span>
          {!onBreak && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => replan('fresh')}
            >
              <RefreshCw className="size-4 mr-2" />
              Reschedule
            </Button>
          )}
        </div>
        <CardTitle className="text-2xl">
          {onBreak
            ? 'On a break ☕'
            : (item?.title ??
              (isLoading || !plan?.saved
                ? 'Preparing your stack…'
                : 'A little breathing room'))}
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
        {plan && mode === 'wrap' && (
          <div className="flex items-center justify-between gap-2 flex-wrap rounded-md bg-muted px-3 py-2 text-sm">
            <span>{wrapMessage(plan)}</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => replan('more')}
            >
              Pull more tasks
            </Button>
          </div>
        )}
        {onBreak ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Take all the time you need. Everything will be right here when you
              get back.
            </p>
            <Button disabled={busy} onClick={() => changeMode('endBreak')}>
              I’m back
            </Button>
            {selection?.item && (
              <details className="text-sm text-muted-foreground">
                <summary className="cursor-pointer">
                  Peek at what’s next
                </summary>
                <p className="mt-2">
                  When you come back: {selection.item.title}
                </p>
              </details>
            )}
          </div>
        ) : null}
        {!onBreak && selection?.upcoming && (
          <p className="text-sm text-muted-foreground">
            Upcoming: {selection.upcoming.title} at{' '}
            {timeOf(selection.upcoming.fixedStart ?? now)}
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
            {askOvernight && overnight?.startedAt !== undefined && plan && (
              <OvernightCheck
                startedAt={overnight.startedAt}
                suggestedStop={suggestedStop(
                  overnight.startedAt,
                  plan.timezone,
                  plan.settings,
                )}
                busy={busy}
                stillWorkingLabel="Yes, I’m still on it"
                onStillWorking={confirm}
                onStopped={stopAt}
              />
            )}
            <div className={askOvernight ? 'hidden' : 'flex gap-2 flex-wrap'}>
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
                  onClick={() => skip(item.id)}
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
          plan?.saved &&
          !onBreak && (
            <div className="space-y-3">
              <Coffee className="size-8 text-primary" />
              <p className="text-sm text-muted-foreground">
                {selection?.upcoming
                  ? 'There is no suitable task before your next appointment.'
                  : skipped.size
                    ? 'You’ve set the other ready tasks aside for now.'
                    : mode === 'wrap'
                      ? 'No chores left. That’s a wrap for today.'
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
              {!!skipped.size && (
                <Button variant="outline" onClick={clearSkipped}>
                  Show skipped tasks again
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
        {plan?.saved && !onBreak && (
          <div className="flex gap-2 flex-wrap border-t pt-4">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => changeMode('startBreak')}
            >
              <Coffee className="size-4 mr-2" />
              Taking a break
            </Button>
            {mode !== 'wrap' && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => changeMode('startWrap')}
              >
                Wrapping up
              </Button>
            )}
          </div>
        )}
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
