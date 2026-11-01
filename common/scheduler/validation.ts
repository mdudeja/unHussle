import { compareTimes } from '@c/datetimeUtils'
import { parseCalendarDate } from '@c/calendarUtils'
import {
  planRuleNames,
  scheduleCues,
  type SchedulerSettings,
  type SchedulerTask,
} from './contracts'

export function validateSettings(settings: SchedulerSettings) {
  for (const dayWindow of [settings, ...Object.values(settings.overrides)]) {
    if (compareTimes(dayWindow.sleep, dayWindow.wake) <= 0)
      throw new Error('Sleep must be after wake time within the same day')
    if (
      dayWindow.workMinutes !== undefined &&
      (!Number.isFinite(dayWindow.workMinutes) ||
        dayWindow.workMinutes < 0 ||
        dayWindow.workMinutes > 1440)
    )
      throw new Error('Invalid work limit')
  }
  for (const date of Object.keys(settings.overrides)) parseCalendarDate(date)
  for (const n of [
    settings.defaultMinutes,
    settings.quickMinutes,
    settings.starterMinutes,
    settings.longMinutes,
    settings.wrapMinutes,
  ]) {
    if (!Number.isFinite(n) || n <= 0 || n > 1440)
      throw new Error('Durations must be between 1 and 1440 minutes')
  }
  if (
    !Array.isArray(settings.workTags) ||
    settings.workTags.some((tag) => typeof tag !== 'string' || !tag.trim())
  )
    throw new Error('Work tags must be nonempty tag names')
  const rules = new Set<string>(planRuleNames)
  const cues = new Set<string>(scheduleCues)
  for (const [cue, names] of Object.entries(settings.rules ?? {})) {
    if (!cues.has(cue)) throw new Error(`Unknown scheduling cue: ${cue}`)
    const unknown = (names ?? []).find((name) => !rules.has(name))
    if (unknown) throw new Error(`Unknown scheduling rule: ${unknown}`)
  }
}

export function validateRecurrence(
  task: Pick<SchedulerTask, 'is_recurring' | 'recurrance_rule' | 'anchor_slot'>,
) {
  if (
    task.anchor_slot !== null &&
    (!Number.isInteger(task.anchor_slot) || task.anchor_slot < 1)
  )
    throw new Error('Anchor slot must be a positive integer')

  if (!task.is_recurring) return

  const rule = task.recurrance_rule

  if (
    !rule ||
    !['daily', 'weekly', 'monthly', 'yearly'].includes(rule.type) ||
    !rule.data ||
    typeof rule.data !== 'object'
  )
    throw new Error('A recurring task needs a valid recurrence rule')

  const data = rule.data
  for (const [values, max] of [
    ['weekDays' in data ? data.weekDays : undefined, 7],
    ['monthDays' in data ? data.monthDays : undefined, 31],
    ['months' in data ? data.months : undefined, 12],
  ] as const) {
    if (
      values !== undefined &&
      (!Array.isArray(values) ||
        values.some((n) => !Number.isInteger(n) || n < 1 || n > max))
    )
      throw new Error('Invalid recurrence calendar selection')
  }
  if (
    data.slots !== undefined &&
    (!Array.isArray(data.slots) ||
      data.slots.some(
        (s) =>
          !s ||
          !Number.isInteger(s.from) ||
          !Number.isInteger(s.to) ||
          s.from < 0 ||
          s.to > 1440 ||
          s.to <= s.from,
      ))
  )
    throw new Error(
      'Recurring slots must have a start before their end within one day',
    )
}
