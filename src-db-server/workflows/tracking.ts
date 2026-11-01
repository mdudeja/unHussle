import { eq, isNull, sql } from 'drizzle-orm'
import { MINUTE_MS } from '@c/datetimeUtils'
import { ProgressStatus } from '@c/types'
import type { ScheduleTx } from '@d/database/repositories/scheduler'
import {
  junctionTimeEntries,
  taskOccurrences,
  tasks,
  timeEntries,
} from '@d/database/schemas'

/**
 * Tracking intervals are the source of daily accounting. Starting work closes
 * (and pauses) every other open interval; any other status closes its own.
 * Closed time is added to the cumulative task and occurrence totals.
 */
export function trackInterval(
  tx: ScheduleTx,
  taskId: string,
  occurrenceId: string | null,
  status: string,
  now: number,
) {
  const starting = status === 'in_progress'
  const open = tx
    .select()
    .from(timeEntries)
    .where(isNull(timeEntries.end_time))
    .all()
  const own = (entry: (typeof open)[number]) =>
    entry.task_id === taskId && entry.occurrence_id === occurrenceId

  for (const entry of open) {
    if (own(entry) === starting) continue
    const elapsed = Math.max(0, now - entry.start_time)
    const minutes = Math.ceil(elapsed / MINUTE_MS)
    tx.update(timeEntries)
      .set({ end_time: now, duration: Math.round(elapsed / 1000) })
      .where(eq(timeEntries.id, entry.id))
      .run()
    tx.update(tasks)
      .set({
        spent_minutes: sql`${tasks.spent_minutes} + ${minutes}`,
        ...(starting && !entry.occurrence_id
          ? { status: ProgressStatus.PAUSED }
          : {}),
      })
      .where(eq(tasks.id, entry.task_id))
      .run()
    if (entry.occurrence_id)
      tx.update(taskOccurrences)
        .set({
          spentMinutes: sql`${taskOccurrences.spentMinutes} + ${minutes}`,
          ...(starting ? { status: ProgressStatus.PAUSED } : {}),
        })
        .where(eq(taskOccurrences.id, entry.occurrence_id))
        .run()
  }

  if (starting && !open.some(own)) {
    const id = crypto.randomUUID()
    tx.insert(timeEntries)
      .values({
        id,
        task_id: taskId,
        occurrence_id: occurrenceId,
        start_time: now,
      })
      .run()
    tx.insert(junctionTimeEntries)
      .values({ attachedToId: taskId, refId: id })
      .run()
  }
}
