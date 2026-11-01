import {
  getNowMillis,
  getLocalDateString,
  getTimeZoneId,
} from '@c/datetimeUtils'
import { addDaysToDate } from '@c/calendarUtils'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { DayPlan } from '@c/scheduler/contracts'
import { useWorkflowQuery, useWorkflowRuntime } from './hooks'
import type { QueryDependency } from './queries'

export const schedulerDependencies: QueryDependency[] = [
  'schedule',
  'occurrences',
  'schedulerSettings',
  'tasks',
  'projects',
  'goals',
  'areas',
  'tags',
  'time_entries',
]

/** Re-renders every `intervalMs` and on resume; per-second ticks only for timers. */
export function useSchedulerClock(intervalMs = 60_000) {
  const [now, setNow] = useState(getNowMillis)
  const sync = useCallback(() => setNow(getNowMillis()), [])
  useEffect(() => {
    const update = sync
    const timer = setInterval(update, intervalMs)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [intervalMs, sync])
  return { now, sync }
}

export function useDayPlan(date: string, timezone: string) {
  const runtime = useWorkflowRuntime()
  const key = `schedule:day:${timezone}:${date}`
  const query = useWorkflowQuery<DayPlan>({
    key,
    dependencies: schedulerDependencies,
    load: () => runtime.scheduler.day(date, timezone),
  })
  const refresh = useCallback(async () => {
    runtime.queries.markStale(key)
    await runtime.queries.ensure(key)
  }, [runtime, key])
  useEffect(() => {
    const onFocus = () => {
      void refresh().catch(() => {})
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])
  return { ...query, refresh }
}

export function useTodayPlan() {
  const { now, sync } = useSchedulerClock()
  const timezone = getTimeZoneId()
  const date = getLocalDateString(now, timezone)
  const query = useDayPlan(date, timezone)
  const runtime = useWorkflowRuntime()
  const attempted = useRef('')
  const [generationError, setGenerationError] = useState<string | null>(null)
  const { data, refresh } = query
  useEffect(() => {
    if (!query.data || query.data.saved || attempted.current === date) return
    attempted.current = date
    runtime.commands
      .execute('scheduler.generate', { date, timezone })
      .catch((error) =>
        setGenerationError(
          error instanceof Error
            ? error.message
            : 'Could not prepare today’s stack',
        ),
      )
  }, [query.data, runtime, date, timezone])
  useEffect(() => {
    if (!data?.saved) return
    const boundaries = data.entries
      .flatMap((e) => [e.fixedStart, e.fixedEnd, e.windowStart, e.windowEnd])
      .filter((n): n is number => n !== null && n > getNowMillis())
    const target = Math.min(getNowMillis() + 60_000, ...boundaries)
    // Re-evaluate the next task at each time boundary, without regenerating.
    const timer = setTimeout(
      () => {
        sync()
        void refresh().catch(() => {})
      },
      Math.max(100, target - getNowMillis()),
    )
    return () => clearTimeout(timer)
  }, [data, refresh, sync])
  return {
    ...query,
    now,
    date,
    timezone,
    generationError,
    tomorrow: addDaysToDate(date, 1),
  }
}

export function useSchedulerAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (work: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'The action could not be completed',
      )
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, run }
}
