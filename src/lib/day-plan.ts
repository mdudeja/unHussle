import type { PlanEntry } from '@c/scheduler/contracts'
import { isPending } from '@c/scheduler/status'
import { ProgressStatus } from '@c/types/enums'
import { formatHhMm } from '@c/datetimeUtils'

// Entry statuses are plain strings; compare them as such.
const IN_PROGRESS: string = ProgressStatus.IN_PROGRESS
const COMPLETED: string = ProgressStatus.COMPLETED

export const isRunning = (entry: Pick<PlanEntry, 'status'>) =>
  entry.status === IN_PROGRESS

/**
 * A day's entries in the order they are shown: appointments by start time,
 * then the flexible stack in plan order, then what is finished or skipped.
 */
export const groupEntries = (entries: PlanEntry[]) => {
  const pending = entries.filter((entry) => isPending(entry.status))
  return {
    appointments: pending
      .filter((entry) => entry.fixedStart !== null)
      .sort((a, b) => (a.fixedStart ?? 0) - (b.fixedStart ?? 0)),
    flexible: pending.filter((entry) => entry.fixedStart === null),
    finished: entries.filter((entry) => !isPending(entry.status)),
  }
}

export const doneCountOf = (entries: PlanEntry[]) =>
  entries.filter((entry) => entry.status === COMPLETED).length

/** Estimated minutes still needed for every open entry, work or not. */
export const remainingMinutesOf = (entries: PlanEntry[]) =>
  entries
    .filter((entry) => isPending(entry.status))
    .reduce((total, entry) => total + entry.minutes, 0)

/** When an entry happens: an appointment's slot or a flexible entry's window. */
export const entryTimeOf = (entry: PlanEntry) => {
  const [start, end] =
    entry.fixedStart !== null
      ? [entry.fixedStart, entry.fixedEnd]
      : [entry.windowStart, entry.windowEnd]
  if (start === null) {
    return null
  }
  const from = formatHhMm(new Date(start))
  return end === null ? from : `${from} - ${formatHhMm(new Date(end))}`
}
