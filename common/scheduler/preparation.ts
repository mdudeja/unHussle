import {
  getDateMinuteMillis,
  getDayBoundsMillis,
  MINUTE_MS,
} from '@c/datetimeUtils'
import { parseCalendarDate } from '@c/calendarUtils'
import { AnchorType, ProgressStatus, Priority } from '@c/types/enums'
import type {
  SchedulerTask,
  SchedulerSettings,
  OccurrenceState,
  PlanEntry,
} from './contracts'

export const occurrenceId = (taskId: string, date: string, slot: number) =>
  `${taskId}:${date}:${slot}`

/** Splits `${taskId}:${date}:${slot}`; task ids never contain colons. */
export const parseOccurrenceId = (id: string) => {
  const [date = '', slot = '0'] = id.split(':').slice(-2)
  return { date, slot: Number(slot) }
}

/** Whether a recurring task has occurrences on a date; mirrors the repository's SQL eligibility. */
export function occursOn(
  task: Pick<
    SchedulerTask,
    'is_recurring' | 'recurrance_rule' | 'scheduled_start'
  >,
  date: string,
  timezone: string,
  slot = 0,
) {
  if (!task.is_recurring || !task.recurrance_rule) return false
  if (slot >= Math.max(1, task.recurrance_rule.data.slots?.length ?? 0))
    return false
  const [, end] = getDayBoundsMillis(date, timezone)
  if (task.scheduled_start !== null && task.scheduled_start >= end) return false
  const day = parseCalendarDate(date)
  const data = task.recurrance_rule.data
  const allows = (values: number[] | undefined, value: number) =>
    !values?.length || values.includes(value)
  return (
    allows('weekDays' in data ? data.weekDays : undefined, day.dayOfWeek) &&
    allows('monthDays' in data ? data.monthDays : undefined, day.day) &&
    allows('months' in data ? data.months : undefined, day.month)
  )
}

const estimateOf = (task: SchedulerTask, settings: SchedulerSettings) =>
  task.estimated_minutes && task.estimated_minutes > 0
    ? task.estimated_minutes
    : task.is_quick
      ? settings.quickMinutes
      : settings.defaultMinutes

/** Expand repository-selected tasks into one entry per task or recurring slot. */
export function expandCandidates(
  tasks: SchedulerTask[],
  date: string,
  timezone: string,
  settings: SchedulerSettings,
  states: OccurrenceState[] = [],
) {
  const result: PlanEntry[] = []
  const stateById = new Map(states.map((state) => [state.id, state]))
  for (const task of tasks) {
    const estimate = estimateOf(task, settings)
    const base = {
      taskId: task.id,
      title: task.title,
      isWork: task.isWork,
      isFun: task.is_fun,
      isChore: task.is_chore,
      isQuick: task.is_quick,
      anchorId: task.anchor_id,
      anchorType: task.anchor_type,
      anchorSlot: task.anchor_slot,
      priorities: [
        task.priority ?? Priority.MEDIUM,
        ...task.collectionPriorities,
      ] satisfies PlanEntry['priorities'],
      createdAt: task.created_at,
      taskData: task.custom_data,
      pinned: false,
    }
    if (!task.is_recurring) {
      const fixedStart =
        task.scheduled_start ??
        (task.scheduled_end === null
          ? null
          : task.scheduled_end - estimate * MINUTE_MS)
      result.push({
        ...base,
        id: task.id,
        occurrenceId: null,
        status: task.status ?? ProgressStatus.PLANNED,
        minutes: Math.max(1, estimate - task.spent_minutes),
        spentMinutes: task.spent_minutes,
        fixedStart,
        fixedEnd:
          task.scheduled_end ??
          (fixedStart === null ? null : fixedStart + estimate * MINUTE_MS),
        windowStart: null,
        windowEnd: null,
        due: task.due_date,
        reason:
          fixedStart !== null
            ? 'Scheduled appointment or task'
            : 'Priority and available capacity',
      })
      continue
    }
    const slots = task.recurrance_rule?.data.slots ?? []
    for (let slot = 0; slot < Math.max(1, slots.length); slot++) {
      const id = occurrenceId(task.id, date, slot)
      const state = stateById.get(id)
      const spent = state?.spentMinutes ?? 0
      const window = slots[slot]
      result.push({
        ...base,
        id,
        occurrenceId: id,
        status: state?.status ?? ProgressStatus.PLANNED,
        minutes: Math.max(1, estimate - spent),
        spentMinutes: spent,
        fixedStart: null,
        fixedEnd: null,
        windowStart: window
          ? getDateMinuteMillis(date, window.from, timezone)
          : null,
        windowEnd: window
          ? getDateMinuteMillis(date, window.to, timezone)
          : null,
        due: null,
        reason: 'Recurring today',
      })
    }
  }
  return result
}

/** Expand candidates and resolve anchors on completed reference tasks before scheduling. */
export function prepareCandidates(input: {
  candidates: SchedulerTask[]
  /** Anchor targets and retained tasks; never scheduled themselves. */
  references?: SchedulerTask[]
  date: string
  timezone: string
  settings: SchedulerSettings
  occurrences?: OccurrenceState[]
  additionalItems?: PlanEntry[]
  excluded?: Set<string>
}): PlanEntry[] {
  const tasks = new Map(
    [...input.candidates, ...(input.references ?? [])].map((task) => [
      task.id,
      task,
    ]),
  )
  const entries = new Map(
    expandCandidates(
      input.candidates,
      input.date,
      input.timezone,
      input.settings,
      input.occurrences,
    ).map((entry) => [entry.id, entry]),
  )
  for (const entry of input.additionalItems ?? [])
    entries.set(entry.id, { ...entry })
  return [...entries.values()]
    .filter((entry) => !input.excluded?.has(entry.id))
    .map((entry) => {
      const anchor = entry.anchorId ? tasks.get(entry.anchorId) : undefined
      if (
        anchor &&
        !anchor.is_recurring &&
        anchor.status === ProgressStatus.COMPLETED &&
        (entry.anchorType === AnchorType.after ||
          entry.anchorType === AnchorType.any_after)
      )
        entry.anchorSatisfied = true
      return entry
    })
}
