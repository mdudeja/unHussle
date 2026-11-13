import { Link } from 'react-router'
import { CalendarClock, Coffee, Loader2, RefreshCw } from 'lucide-react'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { nextTask } from '@c/scheduler/engine'
import {
  dayModeOf,
  runningSinceEarlierDay,
  windDownOf,
} from '@c/scheduler/dayMode'
import { formatHhMm } from '@c/datetimeUtils'
import { OvernightCheck } from './OvernightCheck'
import {
  useTodayPlan,
  useSchedulerAction,
  useSkippedTasks,
  useOvernightAnswer,
  overnightKey,
  suggestedStop,
} from '@/workflows/schedulerHooks'
import type { DayModeChange, DayPlan } from '@c/scheduler/contracts'
import { useWorkflowRuntime } from '@/workflows/hooks'
import { NextTaskFocus } from '@/components/app/next-task-focus'
import { UnavailableHotkeys } from '@/components/app/unavailable-hotkeys'
import { HOTKEY_BUSY_MESSAGE, TASK_HOTKEY_IDS } from '@/lib/hotkeys'
import { isRunning } from '@/lib/day-plan'
import { getEntityItemRoute } from '@/lib/entityRoutes'
import { cn } from '@/lib/utils'
import { useHotkey } from '@/hooks/use-keydown-mgr'

const timeOf = (millis: number) => formatHhMm(new Date(millis))

/** Says why the day is wrapping up, so the switch to chores never surprises. */
const wrapMessage = (plan: DayPlan) =>
  plan.wrapReason === 'windDown'
    ? `You usually wind down at ${timeOf(windDownOf(plan))}, so it’s chores from here.`
    : plan.wrapReason === 'lastTask'
      ? 'You’re on your last task, so only chores are left after it.'
      : 'You’re wrapping up, so only chores are left.'

const WAITING_STATUSES = ['planned', 'paused']

const PREPARING_MESSAGE = 'Your stack is still being prepared.'
const END_BREAK_MESSAGE = 'End your break first.'
const NO_TASK_MESSAGE = 'There’s no task to act on right now.'

export const NextTaskCardComponent = () => {
  const {
    data: plan,
    isLoading,
    error: loadError,
    now,
    date,
    timezone,
    generationError,
    refresh,
  } = useTodayPlan()
  const runtime = useWorkflowRuntime()
  const { run, busy, error } = useSchedulerAction()
  const { skipped, skip, clear: clearSkipped } = useSkippedTasks(date)
  const selection = plan?.saved ? nextTask(plan, now, skipped) : null
  const mode = plan?.saved ? dayModeOf(plan) : 'normal'
  const onBreak = mode === 'break'
  // On a break the card shows the break; the next task is only a peek.
  const item = onBreak ? undefined : selection?.item
  const active = !!item && isRunning(item)
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
      await runtime.commands.execute('scheduler.tracking.stop', {
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
  // Each hotkey runs only when its button is shown and enabled.
  useHotkey('next-task.break', () => {
    if (busy) return HOTKEY_BUSY_MESSAGE
    if (!plan?.saved) return PREPARING_MESSAGE
    void changeMode(onBreak ? 'endBreak' : 'startBreak')
  })
  useHotkey('next-task.wrap', () => {
    if (busy) return HOTKEY_BUSY_MESSAGE
    if (!plan?.saved) return PREPARING_MESSAGE
    if (onBreak) return END_BREAK_MESSAGE
    if (mode === 'wrap') return 'You’re already wrapping up.'
    void changeMode('startWrap')
  })
  useHotkey('next-task.reschedule', () => {
    if (busy) return HOTKEY_BUSY_MESSAGE
    if (onBreak) return END_BREAK_MESSAGE
    void replan('fresh')
  })
  const overdueAppointments =
    plan?.entries.filter(
      (entry) =>
        entry.fixedEnd !== null &&
        entry.fixedEnd < now &&
        WAITING_STATUSES.includes(entry.status),
    ) ?? []
  const loadingMessage = error || loadError || generationError

  const emptyMessage = () => {
    if (!plan) return null
    if (selection?.upcoming)
      return 'There is no suitable task before your next appointment.'
    if (skipped.size) return 'You’ve set the other ready tasks aside for now.'
    if (mode === 'wrap') return 'No chores left. That’s a wrap for today.'
    if (plan.entries.some((entry) => WAITING_STATUSES.includes(entry.status)))
      return 'Your remaining tasks will be available later.'
    if (plan.backlogCount > 0)
      return 'Other tasks remain, but none are relevant at the moment.'
    if (plan.entries.length === 0)
      return 'No tasks are ready yet. Capture something below whenever you like.'
    return 'You’ve reached the end of this stack.'
  }

  const renderBody = () => {
    if (onBreak) {
      return (
        <section className="flex flex-col items-start gap-3">
          <CardTitle className="text-2xl">On a break ☕</CardTitle>
          <p className="text-sm text-muted-foreground">
            Take all the time you need. Everything will be right here when you
            get back.
          </p>
          <Button disabled={busy} onClick={() => changeMode('endBreak')}>
            I’m back
          </Button>
          {selection?.item && (
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer">Peek at what’s next</summary>
              <p className="mt-2">When you come back: {selection.item.title}</p>
            </details>
          )}
        </section>
      )
    }
    if (item && plan) {
      return (
        <NextTaskFocus
          plan={plan}
          item={item}
          skipped={skipped}
          skip={skip}
          blocker={
            askOvernight && overnight?.startedAt !== undefined ? (
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
            ) : undefined
          }
        />
      )
    }
    const isPreparing = isLoading || !plan?.saved
    return (
      <section className="flex flex-col items-start gap-3">
        {isPreparing ? (
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        ) : (
          <Coffee className="size-8 text-primary" />
        )}
        <CardTitle className="text-2xl">
          {isPreparing ? 'Preparing your stack…' : 'A little breathing room'}
        </CardTitle>
        {!isPreparing && (
          <>
            <p className="text-sm text-muted-foreground">{emptyMessage()}</p>
            <div className="flex flex-wrap gap-2">
              {skipped.size > 0 && (
                <Button variant="outline" onClick={clearSkipped}>
                  Show tasks set aside
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
          </>
        )}
      </section>
    )
  }

  return (
    <Card
      className={cn(
        'mx-auto w-full max-w-2xl shadow-calm',
        active && 'ring-primary',
      )}
    >
      {!item && (
        <UnavailableHotkeys
          ids={TASK_HOTKEY_IDS}
          message={onBreak ? END_BREAK_MESSAGE : NO_TASK_MESSAGE}
        />
      )}
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {onBreak ? 'Break time' : active ? 'Current focus' : 'Next up'}
          {mode === 'wrap' && <Badge variant="secondary">Wrapping up</Badge>}
        </p>
        {!onBreak && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => replan('fresh')}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Reschedule
          </Button>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {loadingMessage && (
          <div className="flex flex-col items-start gap-2">
            <p role="alert" className="text-sm text-destructive">
              {loadingMessage}
            </p>
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
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
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
        {renderBody()}
        {!onBreak && selection?.upcoming && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarClock className="size-4" />
            Upcoming: {selection.upcoming.title} at{' '}
            {timeOf(selection.upcoming.fixedStart ?? now)}
          </p>
        )}
      </CardContent>

      {plan?.saved && !onBreak && (
        <CardFooter className="flex flex-col items-stretch gap-3 border-t">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => changeMode('startBreak')}
            >
              <Coffee className="size-4" />
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
          {overdueAppointments.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer">
                An earlier appointment needs a decision
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {overdueAppointments.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      to={getEntityItemRoute('tasks', entry.taskId)}
                      className="hover:underline"
                    >
                      {entry.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          )}
          {plan.stale && (
            <p className="text-xs text-muted-foreground">
              Task details have changed. Reschedule whenever you want a fresh
              stack.
            </p>
          )}
          {plan.conflicts.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer">
                {plan.conflicts.length} planning consideration
                {plan.conflicts.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-2 list-disc pl-5">
                {plan.conflicts.map((conflict) => (
                  <li key={conflict}>{conflict}</li>
                ))}
              </ul>
            </details>
          )}
        </CardFooter>
      )}
    </Card>
  )
}
