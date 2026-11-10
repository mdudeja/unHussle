import { Priority } from '@c/types/enums'
import type {
  DayPlan,
  PlanEntry,
  PlanRuleName,
  ScheduleCue,
  SchedulerSettings,
} from './contracts'

/**
 * What a rule sees while a day is built. Rules express preferences only: the
 * engine enforces fixed times, windows, anchors, capacity and the work limit
 * whenever a rule picks or moves an entry.
 */
export type PlanRuleContext = {
  date: string
  timezone: string
  now: number
  cue: ScheduleCue
  settings: SchedulerSettings
  previous?: DayPlan
  /** Schedulable entries that have not been placed yet. */
  readonly remaining: readonly PlanEntry[]
  /** Placed entries in stack order. */
  readonly stack: readonly PlanEntry[]
  /** 0 overdue, 1 due today, 2 due within a week, 3 otherwise. */
  urgencyOf: (entry: PlanEntry) => number
  /** Unanchored, unscheduled entries that arrangers may reorder. */
  movable: (entry: PlanEntry) => boolean
  /**
   * Places each entry with its whole anchor group when it fits. Required
   * groups are placed even when they don't, with a conflict explaining why.
   */
  pick: (
    entries: readonly PlanEntry[],
    options?: { required?: boolean; reason?: string },
  ) => void
  /** Moves a placed entry; refused when it would break an anchor constraint. */
  move: (entry: PlanEntry, index: number, reason?: string) => boolean
  conflict: (message: string) => void
}

export type PlanRule = (name: PlanRuleName, context: PlanRuleContext) => void

type Compare = (a: PlanEntry, b: PlanEntry) => number

/** Assigns a comparable numeric weight to a priority, with higher values representing greater priority. */
const weight = (value: Priority | null) =>
  value === Priority.HIGH ? 3 : value === Priority.LOW ? 1 : 2

/** Orders items by creation time, using their id as a tiebreaker to ensure a stable, deterministic sequence. */
const byAge: Compare = (a, b) =>
  a.createdAt - b.createdAt || a.id.localeCompare(b.id)

/** Compares items by their due date, placing items without a due date last. */
const byDue: Compare = (a, b) =>
  (a.due ?? Infinity) - (b.due ?? Infinity) || byAge(a, b)

/** Task, project, goal and area priority, then earliest due date. */
const byPriority: Compare = (a, b) => {
  for (let index = 0; index < a.priorities.length; index++) {
    const difference = weight(b.priorities[index]) - weight(a.priorities[index])
    if (difference) return difference
  }
  return byDue(a, b)
}

/** Orders items by fixed start, treating missing starts as zero and using age as a tiebreaker. */
const byStart: Compare = (a, b) =>
  (a.fixedStart ?? 0) - (b.fixedStart ?? 0) || byAge(a, b)

/** Orders items by their window start, using priority ordering as a fallback for equal or missing window starts. */
const byWindow: Compare = (a, b) =>
  (a.windowStart ?? -Infinity) - (b.windowStart ?? -Infinity) ||
  byPriority(a, b)

/** Produces a sorted copy of the entries while leaving the original collection unchanged. */
const sorted = (entries: readonly PlanEntry[], compare: Compare) =>
  [...entries].sort(compare)

/** Moves the first matching short entry to the front of the flexible stack. */
const leadWith =
  (matches: (entry: PlanEntry) => boolean, reason: string): PlanRule =>
  (_name, { stack, movable, urgencyOf, settings, move }) => {
    const first = stack.find(
      (entry) => movable(entry) && entry.status !== 'in_progress',
    )
    if (!first) return
    const lead = stack.find(
      (entry) =>
        movable(entry) &&
        (entry.isFun ||
          entry.isQuick ||
          entry.minutes <= settings.starterMinutes) &&
        urgencyOf(entry) <= urgencyOf(first) &&
        matches(entry),
    )
    if (lead) move(lead, stack.indexOf(first), reason)
  }

export const planRules: { [K in PlanRuleName]?: PlanRule } = {
  keepActive: (_name, { remaining, pick }) => {
    pick(
      remaining.filter(
        (entry) =>
          entry.status === 'in_progress' ||
          entry.status === 'paused' ||
          entry.pinned,
      ),
      { required: true, reason: 'You started this earlier' },
    )
  },

  preScheduled: (_name, { remaining, pick }) => {
    pick(
      sorted(
        remaining.filter((entry) => entry.fixedStart !== null),
        byStart,
      ),
      { required: true },
    )
  },

  recurringOccurrences: (_name, { remaining, pick }) => {
    pick(
      sorted(
        remaining.filter((entry) => entry.occurrenceId !== null),
        byWindow,
      ),
      { required: true },
    )
  },

  urgentCandidates: (_name, { remaining, urgencyOf, pick }) => {
    const urgent = sorted(
      remaining.filter((entry) => urgencyOf(entry) <= 1),
      byPriority,
    )
    pick(
      urgent.filter((entry) => urgencyOf(entry) === 0),
      { required: true, reason: 'Overdue' },
    )
    pick(urgent, { required: true, reason: 'Due today' })
  },

  /** One-off work paused earlier (or on an earlier day) is resumed before new work. */
  resumePaused: (_name, { remaining, pick }) => {
    pick(
      sorted(
        remaining.filter(
          (entry) => entry.status === 'paused' && entry.occurrenceId === null,
        ),
        byPriority,
      ),
      { reason: 'You started this earlier' },
    )
  },

  dueSoon: (_name, { remaining, urgencyOf, pick }) => {
    pick(
      sorted(
        remaining.filter((entry) => urgencyOf(entry) === 2),
        byPriority,
      ),
      { reason: 'Due this week' },
    )
  },

  priorityRanking: (_name, { remaining, pick }) => {
    pick(sorted(remaining, byPriority))
  },

  dueDateRanking: (_name, { remaining, pick }) => {
    pick(
      sorted(
        remaining.filter((entry) => entry.due !== null),
        byDue,
      ),
      { reason: 'Earliest due date' },
    )
  },

  oldestFirst: (_name, { remaining, pick }) => {
    pick(sorted(remaining, byAge))
  },

  /** While wrapping up, only chores join the stack: most urgent first. */
  wrapChores: (_name, { remaining, urgencyOf, pick }) => {
    pick(
      sorted(
        remaining.filter((entry) => entry.isChore),
        (a, b) => urgencyOf(a) - urgencyOf(b) || byPriority(a, b),
      ),
      { reason: 'A chore to wrap up the day' },
    )
  },

  starterTask: leadWith(
    (entry) => entry.isFun || entry.isQuick,
    'An easy starting point',
  ),

  easyReturn: leadWith(
    (entry) => entry.isFun || entry.isQuick,
    'An easy way back in after your break',
  ),

  quickOrFunBetweenLong: (
    _name,
    { stack, movable, urgencyOf, settings, move },
  ) => {
    for (let index = 1; index < stack.length; index++) {
      if (
        stack[index - 1].minutes < settings.longMinutes ||
        stack[index].minutes < settings.longMinutes
      )
        continue
      const quick = stack.find(
        (entry, position) =>
          position > index &&
          movable(entry) &&
          (entry.isQuick ||
            entry.minutes <= settings.starterMinutes ||
            (entry.isFun && urgencyOf(entry) <= urgencyOf(stack[index]))),
      )
      if (
        quick &&
        move(quick, index, 'A quick or fun task between longer tasks')
      )
        index++
    }
  },

  /** Ordinary chores lean toward the end of their urgency group. */
  choresLast: (_name, { stack, movable, urgencyOf, move }) => {
    for (let index = stack.length - 1; index >= 1; index--) {
      const entry = stack[index]
      if (!entry.isChore || !movable(entry)) continue
      let target = index
      while (
        target + 1 < stack.length &&
        movable(stack[target + 1]) &&
        urgencyOf(entry) >= urgencyOf(stack[target + 1])
      )
        target++
      if (target !== index) move(entry, target)
    }
  },

  /** Pinned and active entries return to their saved positions. */
  restorePins: (_name, { previous, stack, move }) => {
    previous?.entries.forEach((old, index) => {
      if (!old.pinned && old.status !== 'in_progress') return
      const entry = stack.find((current) => current.id === old.id)
      if (entry) move(entry, index)
    })
  },
}
