import { dayModeOf } from '@c/scheduler/dayMode'
import {
  getNowMillis,
  getLocalDateString,
  getTimeZoneId,
} from '@c/datetimeUtils'
import {
  addDaysToDate,
  parseCalendarDate,
  getWeekStartDate,
} from '@c/calendarUtils'
import { Link, useSearchParams } from 'react-router'

import {
  ArrowDown,
  ArrowUp,
  Pin,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useWorkflowQuery, useWorkflowRuntime } from '@/workflows/hooks'
import {
  schedulerDependencies,
  useDayPlan,
  useSchedulerAction,
} from '@/workflows/schedulerHooks'
import { isPending } from '@c/scheduler/status'
import type { DayPlan } from '@c/scheduler/contracts'
import { useStore } from '@/store'
import { ButtonGroup } from '@/components/ui/button-group'

function selectedDate(value: string | null) {
  try {
    return parseCalendarDate(value ?? '').toString()
  } catch {
    return getLocalDateString(getNowMillis(), getTimeZoneId())
  }
}

function PlannerNav({
  date,
  setDate,
  week = false,
}: {
  date: string
  setDate: (date: string) => void
  week?: boolean
}) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-2xl font-semibold">
          {week ? 'Your week' : 'Your day'}
        </h1>
        <p className="text-sm text-muted-foreground">
          A stack to draw from, at your pace.
        </p>
      </div>
      <div className="flex gap-2 items-center">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous"
          onClick={() => setDate(addDaysToDate(date, week ? -7 : -1))}
        >
          <ChevronLeft />
        </Button>
        <Input
          aria-label="Plan date"
          className="w-40"
          type="date"
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value)
          }}
        />
        <Button
          variant="outline"
          size="icon"
          aria-label="Next"
          onClick={() => setDate(addDaysToDate(date, week ? 7 : 1))}
        >
          <ChevronRight />
        </Button>
      </div>
      <nav className="flex gap-4 text-sm">
        <ButtonGroup>
          <Button variant="outline">
            <Link to="/">Next task</Link>
          </Button>
          <Button variant="outline">
            <Link to={`/day?date=${date}`}>Day</Link>
          </Button>
          <Button variant="outline">
            <Link to={`/week?date=${date}`}>Week</Link>
          </Button>
        </ButtonGroup>
      </nav>
    </div>
  )
}

function DayStack({
  plan,
  compact = false,
}: {
  plan: DayPlan
  compact?: boolean
}) {
  const runtime = useWorkflowRuntime()
  const { busy, error, run } = useSchedulerAction()
  const base = {
    date: plan.date,
    timezone: plan.timezone,
    revision: plan.revision,
  }
  const pending = plan.entries.filter((i) => isPending(i.status))
  const complete = plan.entries.filter((i) => !isPending(i.status))
  const timed = pending
    .filter((i) => i.fixedStart !== null)
    .sort((a, b) => a.fixedStart! - b.fixedStart!)
  const flexible = pending.filter((i) => i.fixedStart === null)
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="flex gap-2 flex-wrap items-center">
          <Link to={`/day?date=${plan.date}`}>{plan.date}</Link>
          <Badge variant="outline">{plan.saved ? 'Saved' : 'Tentative'}</Badge>
          {dayModeOf(plan) === 'break' && (
            <Badge variant="secondary">On a break ☕</Badge>
          )}
          {dayModeOf(plan) === 'wrap' && (
            <Badge variant="secondary">Wrapping up</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground">
          Work: {Math.round(plan.workUsed)} min done ·{' '}
          {Math.round(plan.workPlanned)} min in stack ·{' '}
          {plan.settings.overrides[plan.date]?.workMinutes ??
            plan.settings.workMinutes}{' '}
          min limit
        </div>
        {error && <p role="alert">{error}</p>}
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() =>
            run(() =>
              runtime.commands.execute(
                plan.saved ? 'scheduler.replan' : 'scheduler.generate',
                base,
              ),
            )
          }
        >
          {plan.saved ? 'Reschedule' : 'Save this day'}
        </Button>
        {plan.stale && (
          <p className="text-xs text-muted-foreground">
            Details changed; your saved order is preserved.
          </p>
        )}
        {!!timed.length && (
          <section className="space-y-2">
            <h2 className="text-sm font-medium">Appointments</h2>
            {timed.map((item) => (
              <div key={item.id} className="rounded-md border p-3">
                <span className="text-xs text-muted-foreground">
                  {new Date(item.fixedStart!).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: plan.timezone,
                  })}
                </span>
                <Button
                  variant="link"
                  className="h-auto px-1 whitespace-normal text-left"
                  onClick={() =>
                    useStore.getState().openEditor('tasks', item.taskId)
                  }
                >
                  {item.title}
                </Button>
              </div>
            ))}
          </section>
        )}
        <section className="space-y-2">
          <h2 className="text-sm font-medium">Flexible stack</h2>
          {flexible.length === 0 && (
            <p className="text-sm text-muted-foreground">Room to breathe.</p>
          )}
          <ol className="space-y-2">
            {flexible.map((item) => {
              const index = plan.entries.findIndex((i) => i.id === item.id)
              return (
                <li key={item.id} className="rounded-md border p-3 space-y-2">
                  <Button
                    variant="link"
                    className="h-auto p-0 whitespace-normal text-left"
                    onClick={() =>
                      useStore.getState().openEditor('tasks', item.taskId)
                    }
                  >
                    {item.title}
                  </Button>
                  <div className="flex gap-1 flex-wrap">
                    {item.occurrenceId && (
                      <Badge variant="outline">Recurring</Badge>
                    )}
                    {item.pinned && <Badge variant="secondary">Pinned</Badge>}
                    {item.windowStart !== null && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.windowStart).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: plan.timezone,
                        })}
                        –
                        {new Date(item.windowEnd!).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: plan.timezone,
                        })}
                      </span>
                    )}
                  </div>
                  {!compact && plan.saved && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy || index === 0}
                        aria-label={`Move ${item.title} up`}
                        onClick={() =>
                          run(() =>
                            runtime.commands.execute('scheduler.adjust', {
                              ...base,
                              itemId: item.id,
                              action: 'move',
                              position: index - 1,
                            }),
                          )
                        }
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy || index === plan.entries.length - 1}
                        aria-label={`Move ${item.title} down`}
                        onClick={() =>
                          run(() =>
                            runtime.commands.execute('scheduler.adjust', {
                              ...base,
                              itemId: item.id,
                              action: 'move',
                              position: index + 1,
                            }),
                          )
                        }
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${item.pinned ? 'Unpin' : 'Pin'} ${item.title}`}
                        disabled={busy}
                        onClick={() =>
                          run(() =>
                            runtime.commands.execute('scheduler.adjust', {
                              ...base,
                              itemId: item.id,
                              action: 'pin',
                            }),
                          )
                        }
                      >
                        <Pin
                          className={
                            item.pinned ? 'size-4 fill-current' : 'size-4'
                          }
                        />
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </section>
        {!!complete.length && (
          <details>
            <summary className="text-sm cursor-pointer">
              Finished and skipped ({complete.length})
            </summary>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {complete.map((i) => (
                <li key={i.id}>
                  {i.title} · {i.status}
                </li>
              ))}
            </ul>
          </details>
        )}
        {!!plan.conflicts.length && (
          <details>
            <summary className="text-sm cursor-pointer">
              Planning considerations ({plan.conflicts.length})
            </summary>
            <ul className="mt-2 text-sm list-disc pl-4">
              {plan.conflicts.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

export function DayPage() {
  const [search, setSearch] = useSearchParams()
  const date = selectedDate(search.get('date'))
  const query = useDayPlan(date, getTimeZoneId())
  return (
    <main className="w-full max-w-4xl mx-auto p-4 space-y-6">
      <PlannerNav date={date} setDate={(date) => setSearch({ date })} />
      {query.error && <p role="alert">{query.error}</p>}
      {query.isLoading && <p>Loading your day…</p>}
      {query.data && <DayStack plan={query.data} />}
    </main>
  )
}

export function WeekPage() {
  const [search, setSearch] = useSearchParams()
  const date = getWeekStartDate(selectedDate(search.get('date')))
  const timezone = getTimeZoneId()
  const runtime = useWorkflowRuntime()
  const query = useWorkflowQuery({
    key: `schedule:week:${timezone}:${date}`,
    dependencies: schedulerDependencies,
    load: () => runtime.scheduler.week(date, timezone),
  })
  return (
    <main className="w-full mx-auto p-4 space-y-6">
      <PlannerNav week date={date} setDate={(date) => setSearch({ date })} />
      {query.error && <p role="alert">{query.error}</p>}
      {query.isLoading && <p>Loading your week…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        {query.data?.map((plan) => (
          <DayStack key={plan.date} plan={plan} compact />
        ))}
      </div>
    </main>
  )
}
