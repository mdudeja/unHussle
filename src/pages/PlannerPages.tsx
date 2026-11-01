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
import { useState } from 'react'
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
import { VaultSettings } from '@/components/app/VaultSettings'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { TagsInput } from '@/components/ui/custom/TagsInput'
import { useWorkflowQuery, useWorkflowRuntime } from '@/workflows/hooks'
import {
  schedulerDependencies,
  useDayPlan,
  useSchedulerAction,
} from '@/workflows/schedulerHooks'
import { isPending } from '@c/scheduler/status'
import type { DayPlan, SchedulerSettings } from '@c/scheduler/contracts'
import { useStore } from '@/store'

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
          variant="ghost"
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
          variant="ghost"
          size="icon"
          aria-label="Next"
          onClick={() => setDate(addDaysToDate(date, week ? 7 : 1))}
        >
          <ChevronRight />
        </Button>
      </div>
      <nav className="flex gap-4 text-sm">
        <Link to="/">Next task</Link>
        <Link to={`/day?date=${date}`}>Day</Link>
        <Link to={`/week?date=${date}`}>Week</Link>
        <Link to="/scheduler/settings">Preferences</Link>
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

function SettingsForm({ initial }: { initial: SchedulerSettings }) {
  const [settings, setSettings] = useState(initial)
  const [overrideDate, setOverrideDate] = useState(() =>
    getLocalDateString(getNowMillis(), getTimeZoneId()),
  )
  const [saved, setSaved] = useState(false)
  const runtime = useWorkflowRuntime()
  const { run, busy, error } = useSchedulerAction()
  const numeric = (
    key:
      | 'workMinutes'
      | 'defaultMinutes'
      | 'quickMinutes'
      | 'starterMinutes'
      | 'longMinutes'
      | 'wrapMinutes',
    label: string,
  ) => (
    <div className="space-y-1">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type="number"
        min={key === 'workMinutes' ? 0 : 1}
        max={1440}
        value={settings[key]}
        onChange={(e) => {
          setSaved(false)
          setSettings({ ...settings, [key]: Number(e.target.value) })
        }}
      />
    </div>
  )
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        void run(async () => {
          await runtime.commands.execute('scheduler.settings.change', {
            settings,
          })
          setSaved(true)
        })
      }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="wake">Usually awake from</Label>
          <Input
            id="wake"
            type="time"
            required
            value={settings.wake}
            onChange={(e) => {
              setSaved(false)
              setSettings({ ...settings, wake: e.target.value })
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sleep">Usually winding down by</Label>
          <Input
            id="sleep"
            type="time"
            required
            value={settings.sleep}
            onChange={(e) => {
              setSaved(false)
              setSettings({ ...settings, sleep: e.target.value })
            }}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="work-tags">
            Work tags (also inherited from collections)
          </Label>
          <TagsInput
            id="work-tags"
            value={settings.workTags.map((title) => ({ title }))}
            onChange={(tags) => {
              setSaved(false)
              setSettings({
                ...settings,
                workTags: tags.map((tag) => tag.title),
              })
            }}
          />
        </div>
        {numeric('workMinutes', 'Daily work limit (minutes)')}
      </div>
      <details className="space-y-4">
        <summary className="cursor-pointer">Duration preferences</summary>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {numeric('defaultMinutes', 'Unestimated task (minutes)')}
          {numeric('quickMinutes', 'Unestimated quick task (minutes)')}
          {numeric('starterMinutes', 'Maximum starter length (minutes)')}
          {numeric('longMinutes', 'Long task threshold (minutes)')}
          {numeric(
            'wrapMinutes',
            'Start wrapping up before wind-down or the last task ends (minutes)',
          )}
        </div>
      </details>
      <section className="space-y-3">
        <h2 className="font-medium">A different kind of day</h2>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="override-date">Date</Label>
            <Input
              id="override-date"
              type="date"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (overrideDate) {
                setSaved(false)
                setSettings({
                  ...settings,
                  overrides: {
                    ...settings.overrides,
                    [overrideDate]: {
                      wake: settings.wake,
                      sleep: settings.sleep,
                      workMinutes: settings.workMinutes,
                    },
                  },
                })
              }
            }}
          >
            Add override
          </Button>
        </div>
        {Object.entries(settings.overrides).map(([date, window]) => (
          <div
            key={date}
            className="border rounded-md p-3 flex flex-wrap gap-3 items-end"
          >
            <span className="self-center text-sm">{date}</span>
            <div>
              <Label htmlFor={`wake-${date}`}>Wake</Label>
              <Input
                id={`wake-${date}`}
                type="time"
                value={window.wake}
                onChange={(e) => {
                  setSaved(false)
                  setSettings({
                    ...settings,
                    overrides: {
                      ...settings.overrides,
                      [date]: { ...window, wake: e.target.value },
                    },
                  })
                }}
              />
            </div>
            <div>
              <Label htmlFor={`sleep-${date}`}>Wind down</Label>
              <Input
                id={`sleep-${date}`}
                type="time"
                value={window.sleep}
                onChange={(e) => {
                  setSaved(false)
                  setSettings({
                    ...settings,
                    overrides: {
                      ...settings.overrides,
                      [date]: { ...window, sleep: e.target.value },
                    },
                  })
                }}
              />
            </div>
            <div>
              <Label htmlFor={`work-${date}`}>Work minutes</Label>
              <Input
                id={`work-${date}`}
                className="w-24"
                type="number"
                min={0}
                max={1440}
                value={window.workMinutes ?? settings.workMinutes}
                onChange={(e) => {
                  setSaved(false)
                  setSettings({
                    ...settings,
                    overrides: {
                      ...settings.overrides,
                      [date]: {
                        ...window,
                        workMinutes: Number(e.target.value),
                      },
                    },
                  })
                }}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const overrides = { ...settings.overrides }
                delete overrides[date]
                setSaved(false)
                setSettings({ ...settings, overrides })
              }}
            >
              Remove
            </Button>
          </div>
        ))}
      </section>
      {error && <p role="alert">{error}</p>}
      {saved && (
        <p role="status">
          Preferences saved. Reschedule when you want to apply them to today’s
          stack.
        </p>
      )}
      <Button disabled={busy} type="submit">
        Save preferences
      </Button>
    </form>
  )
}

export function SchedulerSettingsPage() {
  const runtime = useWorkflowRuntime()
  const query = useWorkflowQuery({
    key: 'schedule:settings',
    dependencies: ['schedulerSettings'],
    load: () => runtime.scheduler.settings(),
  })
  return (
    <main className="w-full max-w-3xl mx-auto p-4 space-y-6">
      <Link to="/" className="text-sm text-muted-foreground">
        Back to next task
      </Link>
      <h1 className="text-2xl font-semibold">Your preferences</h1>
      <p className="text-sm text-muted-foreground">
        These help size your stack. They do not create a workday routine.
      </p>
      {query.error && <p role="alert">{query.error}</p>}
      {query.data ? (
        <SettingsForm initial={query.data} />
      ) : (
        <p>Loading preferences…</p>
      )}
      <VaultSettings />
    </main>
  )
}
