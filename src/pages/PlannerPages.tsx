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

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useWorkflowQuery, useWorkflowRuntime } from '@/workflows/hooks'
import { schedulerDependencies, useDayPlan } from '@/workflows/schedulerHooks'
import { DayStack } from '@/components/app/day-stack'
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
          <DayStack key={plan.date} plan={plan} isCompact />
        ))}
      </div>
    </main>
  )
}
