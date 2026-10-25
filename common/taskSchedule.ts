const MINUTE_MS = 60_000

export type TaskSchedule = {
  scheduled_start?: number | null
  scheduled_end?: number | null
  estimated_minutes?: number | null
}

/**
 * Fills in the missing part of a task's schedule. Given any two of start, end
 * and estimated duration, the third is derived:
 * - start + estimate -> end
 * - end + estimate -> start
 * - start + end -> estimate
 * Values the user set explicitly are never overwritten.
 */
export const resolveTaskSchedule = <T extends TaskSchedule>(
  values: T,
): TaskSchedule => {
  const {
    scheduled_start: start,
    scheduled_end: end,
    estimated_minutes: estimate,
  } = values
  const hasStart = typeof start === 'number'
  const hasEnd = typeof end === 'number'
  const hasEstimate = typeof estimate === 'number' && estimate > 0

  if (hasStart && !hasEnd && hasEstimate) {
    return { ...values, scheduled_end: start + estimate * MINUTE_MS }
  }
  if (!hasStart && hasEnd && hasEstimate) {
    return { ...values, scheduled_start: end - estimate * MINUTE_MS }
  }
  if (hasStart && hasEnd && !hasEstimate && end > start) {
    return {
      ...values,
      estimated_minutes: Math.round((end - start) / MINUTE_MS),
    }
  }
  return values
}

/** Returns an error message when the schedule is inconsistent. */
export const validateTaskSchedule = (
  values: TaskSchedule,
): string | undefined => {
  const { scheduled_start: start, scheduled_end: end } = values
  if (typeof start === 'number' && typeof end === 'number' && end <= start) {
    return 'Scheduled end must be after the start'
  }
  return undefined
}
