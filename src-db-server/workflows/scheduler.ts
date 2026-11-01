import { eq, inArray } from 'drizzle-orm'
import { dayWindow, nextTask, buildDay } from '@c/scheduler/engine'
import { expandCandidates, prepareCandidates } from '@c/scheduler/preparation'
import { isPending } from '@c/scheduler/status'
import {
  getNowMillis,
  getDayBoundsMillis,
  getLocalDateString,
  MINUTE_MS,
} from '@c/datetimeUtils'
import { addDaysToDate, parseCalendarDate } from '@c/calendarUtils'
import { ProgressStatus } from '@c/types'
import {
  defaultSchedulerSettings,
  type DayPlan,
  type OccurrenceState,
  type PlanEntry,
  type ScheduleCue,
  type SchedulerSettings,
  type SchedulerTask,
} from '@c/scheduler/contracts'
import {
  type ScheduleTx,
  countDayCandidates,
  dailyWorkUsed,
  intervalKey,
  readDayTasks,
  readExclusions,
  readOccurrences,
  readOpenIntervals,
  readPlan,
  readReservedBetween,
  readSchedulerTasks,
} from '@d/database/repositories/scheduler'
import { schedulerSettings, tasks } from '@d/database/schemas'

export class ScheduleConflict extends Error {}
export const planId = (date: string, timezone: string) => `${timezone}:${date}`

/** Saved settings over the defaults, so settings saved before a field existed get its default. */
export function readSettings(db: ScheduleTx): SchedulerSettings {
  const saved = db
    .select()
    .from(schedulerSettings)
    .where(eq(schedulerSettings.id, 'default'))
    .get()?.settings
  return { ...defaultSchedulerSettings, overrides: {}, ...saved }
}

/** Throws on an invalid calendar date or timezone. */
function validateDay(date: string, timezone: string) {
  parseCalendarDate(date)
  getDayBoundsMillis(date, timezone)
}

/** In-progress occurrences from earlier days continue in today's stack. */
function continuingEntries(
  db: ScheduleTx,
  settings: SchedulerSettings,
  states: OccurrenceState[],
  date: string,
  timezone: string,
) {
  const others = states.filter(
    (state) =>
      state.status === 'in_progress' && state.date !== date && state.taskId,
  )
  if (!others.length) return []
  const byId = new Map(
    readSchedulerTasks(
      db,
      settings,
      inArray(
        tasks.id,
        others.flatMap((state) => (state.taskId ? [state.taskId] : [])),
      ),
    ).map((task) => [task.id, task]),
  )
  return others.flatMap((state) => {
    const task = state.taskId ? byId.get(state.taskId) : undefined
    return task
      ? entryFor(task, state.id, state.date, timezone, settings, states)
      : []
  })
}

function entryFor(
  task: SchedulerTask,
  id: string,
  date: string,
  timezone: string,
  settings: SchedulerSettings,
  states: OccurrenceState[],
) {
  return expandCandidates([task], date, timezone, settings, states).filter(
    (entry) => entry.id === id,
  )
}

type DayContext = {
  settings: SchedulerSettings
  date: string
  timezone: string
  now: number
  today: string
}

/** Everything a fresh (unsaved) stack is built from. */
function freshCandidates(
  db: ScheduleTx,
  { settings, date, timezone, today }: DayContext,
  exclusions: Iterable<string> = [],
) {
  const occurrences = readOccurrences(db, date, today)
  return prepareCandidates({
    ...readDayTasks(db, settings, date, timezone),
    date,
    timezone,
    settings,
    occurrences,
    additionalItems:
      date === today
        ? continuingEntries(db, settings, occurrences, date, timezone)
        : [],
    excluded: new Set([
      ...exclusions,
      ...readExclusions(db, date, timezone, today),
    ]),
  })
}

/** Builds an unsaved stack for a day from the current database state. */
export function composeDay(
  db: ScheduleTx,
  context: DayContext & { previous?: DayPlan; cue?: ScheduleCue },
  exclusions?: Iterable<string>,
): DayPlan {
  const { settings, date, timezone, now, today } = context
  const plan = buildDay({
    candidates: freshCandidates(db, context, exclusions),
    date,
    timezone,
    now,
    settings,
    previous: context.previous,
    cue: context.cue,
    workUsed: dailyWorkUsed(db, settings, date, timezone, now),
  })
  // Past days are history only: nothing new is suggested for them.
  return date < today ? { ...plan, entries: [] } : plan
}

/** A saved day: its stored order, with live task, occurrence and tracking data. */
function hydrateSaved(
  db: ScheduleTx,
  saved: NonNullable<ReturnType<typeof readPlan>>,
  { settings, date, timezone, now, today }: DayContext,
): DayPlan {
  const rows = saved.entries
  const list = readDayTasks(
    db,
    settings,
    date,
    timezone,
    rows.map((row) => row.sourceTaskId),
    false,
  )
  const occurrences = readOccurrences(
    db,
    date,
    today,
    rows.flatMap((row) => (row.occurrenceId ? [row.occurrenceId] : [])),
  )
  const candidates = prepareCandidates({
    ...list,
    date,
    timezone,
    settings,
    occurrences,
  })
  const byId = new Map(candidates.map((entry) => [entry.id, entry]))
  const taskById = new Map(
    [...list.candidates, ...list.references].map((task) => [task.id, task]),
  )
  const stateById = new Map(occurrences.map((state) => [state.id, state]))

  const entries = rows.map((row): PlanEntry => {
    const task = taskById.get(row.sourceTaskId)
    const state = row.occurrenceId ? stateById.get(row.occurrenceId) : undefined
    const live =
      byId.get(row.itemId) ??
      (task
        ? entryFor(
            task,
            row.itemId,
            state?.date ?? date,
            timezone,
            settings,
            occurrences,
          )[0]
        : undefined)
    // Rows outlive deleted tasks; their recorded status is all that remains.
    const entry =
      live ?? detachedEntry(row.itemId, row.sourceTaskId, row.occurrenceId)
    return {
      ...entry,
      status:
        row.status === 'migrated' || row.status === 'cancelled' || !live
          ? (state?.status ?? row.status)
          : entry.status,
      pinned: row.pinned,
      reason: row.reason ?? entry.reason,
    }
  })
  const present = new Set(entries.map((entry) => entry.id))
  if (date === today)
    for (const entry of continuingEntries(
      db,
      settings,
      occurrences,
      date,
      timezone,
    ))
      if (!present.has(entry.id)) entries.unshift(entry)
  // Fixed commitments are always live, even after the stack was saved.
  for (const entry of candidates)
    if (entry.fixedStart !== null && !present.has(entry.id)) entries.push(entry)

  const open = readOpenIntervals(db)
  for (const entry of entries) {
    const interval = open.get(intervalKey(entry.taskId, entry.occurrenceId))
    if (!interval) continue
    entry.startedAt = interval.start_time
    entry.minutes = Math.max(
      1,
      entry.minutes - Math.max(0, now - interval.start_time) / MINUTE_MS,
    )
  }
  const scheduled = entries.filter(
    (entry) => isPending(entry.status) && byId.has(entry.id),
  ).length
  return {
    date,
    timezone,
    revision: saved.revision,
    stale: saved.stale,
    conflicts: saved.conflicts,
    breakStartedAt: saved.breakStartedAt,
    wrapReason: saved.wrapReason,
    autoWrap: saved.autoWrap,
    entries,
    saved: true,
    settings,
    capacityMinutes: dayWindow(date, timezone, now, settings).capacityMinutes,
    workUsed: dailyWorkUsed(db, settings, date, timezone, now),
    workPlanned: entries
      .filter((entry) => entry.isWork && isPending(entry.status))
      .reduce((total, entry) => total + entry.minutes, 0),
    backlogCount: Math.max(
      0,
      countDayCandidates(db, date, timezone) - scheduled,
    ),
  }
}

function detachedEntry(
  id: string,
  taskId: string,
  occurrenceId: string | null,
): PlanEntry {
  return {
    id,
    taskId,
    taskData: null,
    occurrenceId,
    title: 'Deleted task',
    status: ProgressStatus.CANCELLED,
    minutes: 0,
    spentMinutes: 0,
    isWork: false,
    isFun: false,
    isChore: false,
    isQuick: false,
    fixedStart: null,
    fixedEnd: null,
    windowStart: null,
    windowEnd: null,
    due: null,
    anchorId: null,
    anchorType: null,
    anchorSlot: null,
    priorities: [null, null, null, null],
    createdAt: 0,
    pinned: false,
    reason: '',
  }
}

export function readDay(
  db: ScheduleTx,
  date: string,
  timezone: string,
  now = getNowMillis(),
  exclusions?: Iterable<string>,
  settings = readSettings(db),
): DayPlan {
  validateDay(date, timezone)
  const context = {
    settings,
    date,
    timezone,
    now,
    today: getLocalDateString(now, timezone),
  }
  const saved = readPlan(db, planId(date, timezone))
  return saved
    ? hydrateSaved(db, saved, context)
    : composeDay(db, context, exclusions)
}

/**
 * Tentative stacks from `start`, allocating each one-off to at most one day.
 * Saved plans win over earlier tentative suggestions. Never writes.
 */
export function previewWeek(
  db: ScheduleTx,
  start: string,
  timezone: string,
  now = getNowMillis(),
  until = addDaysToDate(start, 6),
) {
  const settings = readSettings(db)
  const excluded = new Set(readReservedBetween(db, timezone, start, until))
  const plans: DayPlan[] = []
  for (let date = start; date <= until; date = addDaysToDate(date, 1)) {
    const plan = readDay(db, date, timezone, now, excluded, settings)
    plans.push(plan)
    for (const entry of plan.entries)
      if (!entry.occurrenceId) excluded.add(entry.id)
  }
  return plans
}

export function readNext(
  db: ScheduleTx,
  date: string,
  timezone: string,
  now = getNowMillis(),
) {
  const plan = readDay(db, date, timezone, now)
  return { ...nextTask(plan, now), plan }
}
