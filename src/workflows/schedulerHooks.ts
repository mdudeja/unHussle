import {
  getNowMillis,
  getLocalDateString,
  getTimeZoneId,
} from '@c/datetimeUtils'
import { addDaysToDate } from '@c/calendarUtils'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { DayPlan, SchedulerSettings } from '@c/scheduler/contracts'
import { windDownOf, wrapUpReason } from '@c/scheduler/dayMode'
import { ProgressStatus, type TimeEntry } from '@c/types'
import { Logger } from '@c/Logger'
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

  // Wrap-up starts on its own once; the backend ignores it after a pull for more.
  const reason = data ? wrapUpReason(data, now) : null
  const wrapped = useRef('')

  useEffect(() => {
    const key = `${date}:${reason}`
    if (!reason || wrapped.current === key) return
    wrapped.current = key
    runtime.commands
      .execute('scheduler.mode.change', {
        date,
        timezone,
        change: 'startWrap',
        reason,
      })
      .catch((error) =>
        Logger.getInstance().error('Could not start wrapping up', { error }),
      )
  }, [reason, runtime, date, timezone])

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

const skippedKey = (date: string) => `unhussle.skipped:${date}`

/**
 * Tasks passed over with "Do something else", per day. Kept in localStorage so
 * they stay skipped across reloads; a re-plan clears them.
 */
export function useSkippedTasks(date: string) {
  const read = useCallback((): string[] => {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem(skippedKey(date)) ?? '[]',
      )
      return Array.isArray(value)
        ? value.filter((id): id is string => typeof id === 'string')
        : []
    } catch {
      return []
    }
  }, [date])
  const [state, setState] = useState(() => ({ date, ids: read() }))
  // A new day starts with nothing skipped.
  const ids = state.date === date ? state.ids : read()
  if (state.date !== date) setState({ date, ids })
  const save = (next: string[]) => {
    // Earlier days' skips are never read again.
    for (const key of Object.keys(localStorage))
      if (key.startsWith(skippedKey('')) && key !== skippedKey(date))
        localStorage.removeItem(key)
    if (next.length)
      localStorage.setItem(skippedKey(date), JSON.stringify(next))
    else localStorage.removeItem(skippedKey(date))
    setState({ date, ids: next })
  }
  return {
    skipped: new Set(ids),
    skip: (id: string) => save([...new Set([...ids, id])]),
    clear: () => save([]),
  }
}

const overnightStorageKey = 'unhussle.overnight-ok'

/** Identifies one running interval, so a new interval asks again. */
export const overnightKey = (
  taskId: string,
  occurrenceId: string | null,
  startedAt: number,
) => `${taskId}|${occurrenceId ?? ''}|${startedAt}`

const readOvernightAnswer = () =>
  typeof localStorage === 'undefined'
    ? null
    : localStorage.getItem(overnightStorageKey)

/** Whether the user already said they're still working on this interval. */
export const isStillWorking = (key: string) => readOvernightAnswer() === key

/** Where "I stopped at" starts: the start day's wind-down, if after the start. */
export function suggestedStop(
  startedAt: number,
  timezone: string,
  settings: SchedulerSettings,
) {
  const windDown = windDownOf({
    date: getLocalDateString(startedAt, timezone),
    timezone,
    settings,
  })
  return windDown > startedAt ? windDown : startedAt
}

/**
 * The open one-off interval of a task that has run since an earlier day and
 * hasn't been confirmed as still going: its start, or `undefined`.
 */
export function overnightStart(
  task: {
    id: string
    status: string | null
    timeEntries?: TimeEntry['Read'][]
  },
  now = getNowMillis(),
  timezone = getTimeZoneId(),
) {
  if (task.status !== ProgressStatus.IN_PROGRESS) return undefined
  const open = task.timeEntries?.find(
    (entry) => entry.end_time === null && entry.occurrence_id === null,
  )
  if (
    !open ||
    getLocalDateString(open.start_time, timezone) >=
      getLocalDateString(now, timezone) ||
    isStillWorking(overnightKey(task.id, null, open.start_time))
  )
    return undefined
  return open.start_time
}

/** Remembers a "still on it" answer for `interval`. */
export function useOvernightAnswer(interval: string | null) {
  const [answered, setAnswered] = useState(readOvernightAnswer)
  return {
    stillWorking: interval !== null && answered === interval,
    confirm: () => {
      if (!interval) return
      localStorage.setItem(overnightStorageKey, interval)
      setAnswered(interval)
    },
  }
}
