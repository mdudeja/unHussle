import {
  getDateTimeMillis,
  getLocalDateString,
  MINUTE_MS,
} from '@c/datetimeUtils'
import type { DayPlan, PlanEntry, WrapReason } from './contracts'
import { isPending } from './status'

export type DayMode = 'normal' | 'break' | 'wrap'

/** A break takes precedence: wrapping up resumes when the break ends. */
export const dayModeOf = (
  plan: Pick<DayPlan, 'breakStartedAt' | 'wrapReason'>,
): DayMode =>
  plan.breakStartedAt !== null ? 'break' : plan.wrapReason ? 'wrap' : 'normal'

/** When the user is usually winding down on the plan's date. */
export const windDownOf = (
  plan: Pick<DayPlan, 'date' | 'timezone' | 'settings'>,
) =>
  getDateTimeMillis(
    plan.date,
    (plan.settings.overrides[plan.date] ?? plan.settings).sleep,
    plan.timezone,
  )

/**
 * Why today's saved plan should start wrapping up on its own, if it should:
 * - `windDown`: within `wrapMinutes` of wind-down (never once it has passed);
 * - `lastTask`: the last flexible non-chore task is in progress and has at
 *   most `wrapMinutes` left. A shorter task wraps up as soon as it starts.
 * Never while on a break, already wrapping up, or after the user pulled more.
 */
export function wrapUpReason(plan: DayPlan, now: number): WrapReason | null {
  if (
    !plan.saved ||
    !plan.autoWrap ||
    dayModeOf(plan) !== 'normal' ||
    getLocalDateString(now, plan.timezone) !== plan.date
  )
    return null
  const lead = plan.settings.wrapMinutes * MINUTE_MS
  const windDown = windDownOf(plan)
  if (now < windDown && now >= windDown - lead) return 'windDown'

  const remaining = plan.entries.filter(
    (entry) =>
      isPending(entry.status) && entry.fixedStart === null && !entry.isChore,
  )
  const [last] = remaining
  // `minutes` is what remains of the estimate as of the plan's last read.
  return remaining.length === 1 &&
    last.status === 'in_progress' &&
    last.minutes <= plan.settings.wrapMinutes
    ? 'lastTask'
    : null
}

/** Running work whose interval opened on an earlier local day than `today`. */
export const runningSinceEarlierDay = (
  entry: Pick<PlanEntry, 'status' | 'startedAt'>,
  today: string,
  timezone: string,
) =>
  entry.status === 'in_progress' &&
  entry.startedAt !== undefined &&
  getLocalDateString(entry.startedAt, timezone) < today
