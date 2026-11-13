import { useState } from 'react'
import { Link } from 'react-router'
import { CalendarClock, ListTodo, Loader2, RefreshCw } from 'lucide-react'
import { formatSpentTime, getLocalDateString } from '@c/datetimeUtils'
import { addDaysToDate, parseCalendarDate } from '@c/calendarUtils'
import { dayWindow } from '@c/scheduler/engine'
import { dayModeOf } from '@c/scheduler/dayMode'
import type { DayPlan, PlanEntry } from '@c/scheduler/contracts'
import { ProgressStatus } from '@c/types/enums'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  DateMeta,
  EntityIcon,
  StatusPriorityIcons,
  TaskFlags,
} from '@/components/ui/custom/list/fields'
import { ListItem } from '@/components/ui/custom/list/list-item'
import { ActionListItem } from '@/components/app/action-list-item'
import { DeferDialog } from '@/components/app/defer-dialog'
import { EntryTimer } from '@/components/app/entry-timer'
import type { EntityAction } from '@/lib/entityActions'
import { usePlanEntryActions } from '@/lib/entityActions/use-plan-entry-actions'
import { getEntityItemRoute } from '@/lib/entityRoutes'
import {
  doneCountOf,
  entryTimeOf,
  groupEntries,
  isRunning,
  remainingMinutesOf,
} from '@/lib/day-plan'
import { cn } from '@/lib/utils'
import { useWorkflowRuntime } from '@/workflows/hooks'
import { adjustEntry } from '@/workflows/plan-entry-commands'
import {
  useSchedulerAction,
  useSchedulerClock,
  useSkippedTasks,
} from '@/workflows/schedulerHooks'

// Same as the task list: start or pause on the row, the rest in its menu.
const PRIMARY_ACTION_IDS = ['start', 'pause']
const PERCENT = 100

type EntryRowProps = {
  entry: PlanEntry
  actions?: EntityAction<PlanEntry>[]
  isSetAside?: boolean
  isCompact: boolean
}

function EntryRow({
  entry,
  actions,
  isSetAside = false,
  isCompact,
}: EntryRowProps) {
  const isActive = isRunning(entry)
  const time = entryTimeOf(entry)
  const timer = isActive && (
    <span className="text-primary">
      Running{' '}
      <EntryTimer
        spentMinutes={entry.spentMinutes}
        startedAt={entry.startedAt}
      />
    </span>
  )
  const meta = isCompact ? (
    (time || timer) && (
      <>
        {time && <span>{time}</span>}
        {timer}
      </>
    )
  ) : (
    <>
      {time && <span>{time}</span>}
      {timer ||
        (entry.minutes > 0 && (
          <span>{formatSpentTime(entry.minutes)} left</span>
        ))}
      <TaskFlags
        task={{
          is_fun: entry.isFun,
          is_quick: entry.isQuick,
          is_chore: entry.isChore,
        }}
      />
      {entry.occurrenceId && <Badge variant="outline">Recurring</Badge>}
      {entry.pinned && <Badge variant="secondary">Pinned</Badge>}
      {isSetAside && <Badge variant="outline">Set aside</Badge>}
      <DateMeta label="Due" millis={entry.due} />
    </>
  )
  const props = {
    title: entry.title,
    href: getEntityItemRoute('tasks', entry.taskId),
    media: (
      <EntityIcon
        fallback={entry.fixedStart !== null ? CalendarClock : ListTodo}
      />
    ),
    indicators: (
      <StatusPriorityIcons
        status={entry.status as ProgressStatus}
        priority={entry.priorities[0]}
      />
    ),
    meta,
    isCompact,
  }

  if (!actions) {
    return (
      <ListItem
        {...props}
        className="bg-background text-muted-foreground shadow-none"
      />
    )
  }
  return (
    <ActionListItem
      {...props}
      item={entry}
      actions={actions}
      primaryActionIds={PRIMARY_ACTION_IDS}
      className={cn(isActive && 'border-primary bg-primary/5')}
    />
  )
}

/**
 * One day at a glance: progress against the work limit, appointments, the
 * flexible stack in plan order, and what is finished. Every entry has the
 * next task card's actions, so tasks can be done in any order.
 */
export function DayStack({
  plan,
  isCompact = false,
}: {
  plan: DayPlan
  isCompact?: boolean
}) {
  const runtime = useWorkflowRuntime()
  const { now } = useSchedulerClock()
  const today = getLocalDateString(now, plan.timezone)
  const { busy, error, run } = useSchedulerAction()
  const { skipped, skip, clear } = useSkippedTasks(plan.date)
  const [deferring, setDeferring] = useState<PlanEntry | null>(null)
  const actions = usePlanEntryActions({
    plan,
    today,
    skipped,
    skip,
    onDefer: setDeferring,
  })

  const { appointments, flexible, finished } = groupEntries(plan.entries)
  const mode = dayModeOf(plan)
  const limit = dayWindow(
    plan.date,
    plan.timezone,
    now,
    plan.settings,
  ).workLimit
  const done = doneCountOf(plan.entries)
  const total = plan.entries.length
  const setAsideCount =
    plan.date === today
      ? flexible.filter((entry) => skipped.has(entry.id)).length
      : 0
  const earliestDeferral = addDaysToDate(
    plan.date > today ? plan.date : today,
    1,
  )

  const renderRows = (entries: PlanEntry[]) =>
    entries.map((entry) => (
      <EntryRow
        key={entry.id}
        entry={entry}
        actions={actions}
        isSetAside={skipped.has(entry.id)}
        isCompact={isCompact}
      />
    ))

  return (
    <Card className="min-w-0 bg-muted shadow-none">
      <CardHeader className="flex flex-col gap-3">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Link to={`/day?date=${plan.date}`} className="hover:underline">
              {parseCalendarDate(plan.date).toLocaleString([], {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}
            </Link>
            {plan.date === today && <Badge>Today</Badge>}
            <Badge variant="outline">
              {plan.saved ? 'Saved' : 'Tentative'}
            </Badge>
            {mode === 'break' && (
              <Badge variant="secondary">On a break ☕</Badge>
            )}
            {mode === 'wrap' && <Badge variant="secondary">Wrapping up</Badge>}
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              run(() =>
                runtime.commands.execute(
                  plan.saved ? 'scheduler.replan' : 'scheduler.generate',
                  {
                    date: plan.date,
                    timezone: plan.timezone,
                    revision: plan.revision,
                  },
                ),
              )
            }
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              plan.saved && <RefreshCw className="size-4" />
            )}
            {plan.saved ? 'Reschedule' : 'Save this day'}
          </Button>
        </div>
        <p className="flex w-full flex-wrap gap-x-3 gap-y-1 text-sm">
          <span className="font-medium">
            {done} of {total} done
          </span>
          <span className="text-muted-foreground">
            {formatSpentTime(remainingMinutesOf(plan.entries))} left
          </span>
        </p>
        <Progress
          value={Math.min(PERCENT, (plan.workUsed / limit) * PERCENT)}
          aria-label="Work done against the day's work limit"
          // The track defaults to `muted`, the colour of this card.
          className="w-full gap-1.5 [&_[data-slot=progress-track]]:bg-background"
        >
          {/* Only tasks in collections tagged as work count here. */}
          <p className="flex w-full flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              Work: {formatSpentTime(plan.workUsed)} of {formatSpentTime(limit)}{' '}
              done
            </span>
            <span>{formatSpentTime(plan.workPlanned)} of work planned</span>
          </p>
        </Progress>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {plan.stale && (
          <p className="text-xs text-muted-foreground">
            Task details changed. Your saved order is kept; reschedule for a
            fresh stack.
          </p>
        )}
        {setAsideCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{setAsideCount} set aside for now.</span>
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              Show tasks set aside
            </Button>
          </div>
        )}
        {appointments.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Appointments</h2>
            <ul className="flex flex-col gap-2">{renderRows(appointments)}</ul>
          </section>
        )}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-medium">Flexible stack</h2>
          {flexible.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing left to do. Room to breathe.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">{renderRows(flexible)}</ol>
          )}
        </section>
        {finished.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm">
              Finished and skipped ({finished.length})
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
              {finished.map((entry) => (
                <EntryRow key={entry.id} entry={entry} isCompact={isCompact} />
              ))}
            </ul>
          </details>
        )}
        {plan.conflicts.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm">
              Planning considerations ({plan.conflicts.length})
            </summary>
            <ul className="mt-2 list-disc pl-4 text-sm">
              {plan.conflicts.map((conflict) => (
                <li key={conflict}>{conflict}</li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
      {deferring && (
        <DeferDialog
          title={deferring.title}
          earliest={earliestDeferral}
          onConfirm={(until) =>
            adjustEntry(runtime, plan, deferring, 'defer', { until })
          }
          onClose={() => setDeferring(null)}
        />
      )}
    </Card>
  )
}
