import {
  getDayBoundsMillis,
  getLocalDateString,
  getDateTimeMillis,
  MINUTE_MS,
} from '@c/datetimeUtils'
import { addDaysToDate } from '@c/calendarUtils'
import { Logger } from '@c/Logger'
import type {
  DayPlan,
  PlanEntry,
  PlanRuleRegistry,
  SchedulerSettings,
  ScheduleCue,
} from './contracts'
import { resolveAnchors, isBeforeAnchor } from './anchors'
import { isPending } from './status'
import { planRules, type PlanRuleContext } from './rules'
import { planRuleRegistry, rulesFor } from './ruleRegistry'

type Interval = [number, number]

/** Determines the urgency level of a plan entry by comparing its due date with the specified date in the given timezone. */
function urgency(entry: PlanEntry, date: string, timezone: string) {
  if (entry.due === null) return 3
  const day = getLocalDateString(entry.due, timezone)
  if (day < date) return 0
  if (day === date) return 1
  return day <= addDaysToDate(date, 7) ? 2 : 3
}

/**
 * The schedulable part of a day: from wake (or now, today) until sleep. With
 * `pastWindDown`, a day already past its wind-down runs until midnight, so
 * work the user asks for after wind-down still fits.
 */
export function dayWindow(
  date: string,
  timezone: string,
  now: number,
  settings: SchedulerSettings,
  { pastWindDown = false }: { pastWindDown?: boolean } = {},
) {
  const window = settings.overrides[date] ?? settings
  const start = Math.max(
    getDateTimeMillis(date, window.wake, timezone),
    getLocalDateString(now, timezone) === date ? now : 0,
  )
  const sleep = getDateTimeMillis(date, window.sleep, timezone)
  const end =
    pastWindDown && start >= sleep
      ? getDayBoundsMillis(date, timezone)[1]
      : sleep
  return {
    start,
    end,
    capacityMinutes: Math.max(0, (end - start) / MINUTE_MS),
    workLimit: window.workMinutes ?? settings.workMinutes,
  }
}

/**
 * Builds a day by running the cue's rules in registry order. Rules choose and
 * arrange entries; this function owns every hard constraint.
 */
export function buildDay(
  input: {
    candidates: PlanEntry[]
    date: string
    timezone: string
    now: number
    settings: SchedulerSettings
    previous?: DayPlan
    workUsed?: number
    cue?: ScheduleCue
  },
  registry: PlanRuleRegistry = planRuleRegistry,
): DayPlan {
  const { date, timezone, now, settings, previous } = input
  const cue = input.cue ?? 'fresh'
  const workUsed = input.workUsed ?? 0
  // Wrapping up and pulling more are explicit requests, even after wind-down.
  const { start, end, capacityMinutes, workLimit } = dayWindow(
    date,
    timezone,
    now,
    settings,
    { pastWindDown: cue === 'wrap' || cue === 'more' },
  )
  const pinnedEarlier = new Set(
    previous?.entries.filter((entry) => entry.pinned).map((entry) => entry.id),
  )

  const entries = input.candidates.map((entry) => ({
    ...entry,
    pinned: entry.pinned || pinnedEarlier.has(entry.id),
  }))

  const urgencyById = new Map(
    entries.map((entry) => [entry.id, urgency(entry, date, timezone)]),
  )

  /** Provides the urgency level assigned to a plan entry, using a default urgency when no specific value is available. */
  const urgencyOf = (entry: PlanEntry) => urgencyById.get(entry.id) ?? 3

  const anchors = resolveAnchors(entries)

  for (const entry of entries)
    if (anchors.satisfied.has(entry.id)) entry.anchorSatisfied = true

  const conflicts: string[] = [...anchors.errors.values()]

  // Pending, unblocked entries in an order that already satisfies anchors.
  const order = new Map(
    anchors.ordered.map((entry, index) => [entry.id, index]),
  )

  /** Determines whether a plan entry is free to be moved or rescheduled. */
  const movable = (entry: PlanEntry) =>
    !entry.anchorId &&
    !anchors.anchorTasks.has(entry.taskId) &&
    entry.fixedStart === null

  let free: Interval[] = end > start ? [[start, end]] : []

  /**
   * Reserves a time interval from the free intervals, splitting them as needed.
   */
  const reserve = (from: number, to: number) => {
    free = free.flatMap(([s, e]): Interval[] =>
      // if the interval to reserve is completely outside this free interval, keep it as-is.
      to <= s || from >= e
        ? [[s, e]]
        : (
            [
              [s, Math.max(s, from)],
              [Math.min(e, to), e],
            ] satisfies Interval[]
          ).filter(([l, r]) => r > l),
    )
  }

  // Appointment time is never available to flexible work, whatever the rules.
  const fixed = anchors.ordered
    .filter((entry) => entry.fixedStart !== null)
    .sort((a, b) => (a.fixedStart ?? 0) - (b.fixedStart ?? 0))
  let latestEnd = -Infinity
  for (const entry of fixed) {
    const from = entry.fixedStart ?? 0
    const to = entry.fixedEnd ?? from
    reserve(from, to)
    if (latestEnd > from)
      conflicts.push(`${entry.title}: overlapping appointments`)
    latestEnd = Math.max(latestEnd, to)
  }

  const stack: PlanEntry[] = []
  const placed = new Set<string>()
  let workPlanned = 0

  /** Fits a whole anchor group into the free intervals, in anchor order. */
  const fit = (group: PlanEntry[]) => {
    let cursor = start
    let fits = true
    group.forEach((entry, index) => {
      if (entry.fixedStart !== null) {
        if (cursor > entry.fixedStart && entry.fixedStart > start) fits = false
        cursor = Math.max(cursor, entry.fixedEnd ?? entry.fixedStart)
        return
      }
      const length = entry.minutes * MINUTE_MS
      const nextFixed =
        group.slice(index + 1).find((member) => member.fixedStart !== null)
          ?.fixedStart ?? end
      const lower = Math.max(cursor, entry.windowStart ?? start)
      const upper = Math.min(nextFixed, entry.windowEnd ?? end)
      const late = entry.occurrenceId && (entry.windowEnd ?? end) < now
      const gap =
        free.find(
          ([s, e]) => Math.min(e, upper) - Math.max(s, lower) >= length,
        ) ??
        // A late occurrence may still be done today, outside its window.
        (late
          ? free.find(
              ([s, e]) => Math.min(e, nextFixed) - Math.max(s, lower) >= length,
            )
          : undefined)
      if (!gap) {
        fits = false
        return
      }
      const from = Math.max(gap[0], lower)
      reserve(from, from + length)
      cursor = from + length
    })
    return fits
  }

  /** Attempts to place a plan entry and its related group into the day’s plan when ordering, capacity, and work limits allow, recording conflicts for required placements that cannot fit. */
  const place = (entry: PlanEntry, required: boolean, reason?: string) => {
    if (placed.has(entry.id) || !order.has(entry.id)) return
    const group = (anchors.groups.get(entry.id) ?? [entry])
      .filter((member) => order.has(member.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    const work = group
      .filter((member) => member.isWork)
      .reduce((total, member) => total + member.minutes, 0)
    const overWork = work > 0 && workUsed + workPlanned + work > workLimit
    if (overWork && !required) return
    const before = free
    const fits = fit(group)
    if (!fits && !required && cue !== 'more') {
      free = before
      return
    }
    if (!fits)
      conflicts.push(
        `${entry.title}: exceeds remaining day capacity or conflicts with its anchor time`,
      )
    if (overWork) conflicts.push(`${entry.title}: exceeds daily work limit`)
    workPlanned += work
    if (reason) entry.reason = reason
    for (const member of group) {
      placed.add(member.id)
      stack.push(member)
    }
  }

  const context: PlanRuleContext = {
    date,
    timezone,
    now,
    cue,
    settings,
    previous,
    /** Provides the anchors that have not yet been placed. */
    get remaining() {
      return anchors.ordered.filter((entry) => !placed.has(entry.id))
    },
    stack,
    urgencyOf,
    movable,
    pick: (picked, { required = false, reason } = {}) => {
      for (const entry of picked) place(entry, required, reason)
    },
    move: (entry, index, reason) => {
      const from = stack.indexOf(entry)
      if (from < 0) return false
      const violations = anchors.violations(stack).length
      stack.splice(from, 1)
      const to = Math.max(0, Math.min(index, stack.length))
      stack.splice(to, 0, entry)
      if (anchors.violations(stack).length > violations) {
        stack.splice(to, 1)
        stack.splice(from, 0, entry)
        return false
      }
      if (reason) entry.reason = reason
      return true
    },
    conflict: (message) => {
      conflicts.push(message)
    },
  }

  for (const name of rulesFor(cue, settings, registry)) {
    const rule = planRules[name]
    if (!rule) {
      Logger.getInstance().warn(`Plan rule not found: ${name}. Skipping...`)
      continue
    }
    rule(name, context)
  }
  // Appointments and active work stay visible even when no rule picked them.
  context.pick(
    context.remaining.filter(
      (entry) =>
        entry.fixedStart !== null ||
        entry.status === 'in_progress' ||
        entry.status === 'paused',
    ),
    { required: true },
  )
  conflicts.push(...anchors.violations(stack))

  return {
    date,
    timezone,
    revision: previous?.revision ?? 0,
    saved: false,
    stale: false,
    breakStartedAt: previous?.breakStartedAt ?? null,
    wrapReason: previous?.wrapReason ?? null,
    autoWrap: previous?.autoWrap ?? true,
    entries: stack,
    conflicts: [...new Set(conflicts)],
    workUsed,
    workPlanned,
    capacityMinutes,
    backlogCount: entries.filter(
      (entry) => isPending(entry.status) && !placed.has(entry.id),
    ).length,
    settings,
  }
}

/** `skipped` holds entries the user passed over with "Do something else". */
export function nextTask(
  plan: DayPlan,
  now: number,
  skipped: ReadonlySet<string> | string = new Set(),
) {
  const skips = typeof skipped === 'string' ? new Set([skipped]) : skipped
  const pending = plan.entries.filter((entry) => isPending(entry.status))
  let active: PlanEntry | undefined
  let appointment: PlanEntry | undefined
  let upcoming: PlanEntry | undefined

  for (const entry of pending) {
    if (entry.status === 'in_progress') active ??= entry
    const { fixedStart } = entry
    if (fixedStart === null) continue
    if (
      fixedStart <= now &&
      (entry.fixedEnd ?? Infinity) > now &&
      (!appointment || fixedStart < (appointment.fixedStart ?? Infinity))
    )
      appointment = entry
    if (
      fixedStart > now &&
      (!upcoming || fixedStart < (upcoming.fixedStart ?? Infinity))
    )
      upcoming = entry
  }

  if (active) return { item: active, upcoming: appointment ?? upcoming ?? null }
  if (appointment) return { item: appointment, upcoming: upcoming ?? null }

  const anchors = resolveAnchors(plan.entries)
  /** Provides summarized scheduling and readiness information for a chain of plan entries. */
  const chainInfo = (chain: PlanEntry[]) => ({
    duration: chain
      .filter((member) => member.fixedStart === null)
      .reduce((total, member) => total + member.minutes * MINUTE_MS, 0),
    ready: chain.every(
      (member) => member.windowStart === null || member.windowStart <= now,
    ),
    bypassed: chain.some((member) => skips.has(member.id)),
    fixedStart: Math.min(
      ...chain.flatMap((member) =>
        member.fixedStart !== null && member.fixedStart > now
          ? [member.fixedStart]
          : [],
      ),
    ),
  })
  const chains = new Map<PlanEntry[], ReturnType<typeof chainInfo>>()
  /** Provides the chain information for the chain of adjacent plan entries that includes the given entry. */
  const chainOf = (entry: PlanEntry) => {
    const chain = anchors.adjacentGroups.get(entry.id) ?? [entry]
    let info = chains.get(chain)
    if (!info) chains.set(chain, (info = chainInfo(chain)))
    return info
  }
  const upcomingStart = upcoming?.fixedStart ?? null
  const item = pending.find((entry) => {
    if (
      skips.has(entry.id) ||
      entry.fixedStart !== null ||
      anchors.blocked.has(entry.id) ||
      anchors.beforeDependents.has(entry.id)
    )
      return false
    const anchor = anchors.targets.get(entry.id)
    if (anchor && !isBeforeAnchor(entry) && anchor.status !== 'completed')
      return false
    const chain = chainOf(entry)
    if (
      !chain.ready ||
      chain.bypassed ||
      (Number.isFinite(chain.fixedStart) &&
        chain.fixedStart - now > chain.duration)
    )
      return false
    return upcomingStart === null || chain.duration <= upcomingStart - now
  })
  return { item: item ?? null, upcoming: upcoming ?? null }
}
