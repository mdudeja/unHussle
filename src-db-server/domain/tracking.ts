import { and, eq, isNull, sql } from 'drizzle-orm'
import { MINUTE_MS } from '@c/datetimeUtils'
import { ProgressStatus } from '@c/types/enums'
import type { ScheduleTx } from '@d/database/repositories/scheduler'
import {
  junctionTimeEntries,
  taskOccurrences,
  tasks,
  timeEntries,
} from '@d/database/schemas'
import { syncPlanMembership } from './scheduleMaintenance'

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
  const taskIds = new Set<string>()
  const occurrenceIds = new Set<string>()
  const starting = status === 'in_progress'
  const open = tx
    .select()
    .from(timeEntries)
    .where(isNull(timeEntries.end_time))
    .all()

  /** Determines whether the given entry belongs to the current task and occurrence. */
  const own = (entry: (typeof open)[number]) =>
    entry.task_id === taskId && entry.occurrence_id === occurrenceId

  for (const entry of open) {
    if (own(entry) === starting) continue
    taskIds.add(entry.task_id)
    if (entry.occurrence_id) occurrenceIds.add(entry.occurrence_id)
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
  // Saved one-off membership follows tasks paused as part of a different command.
  for (const id of taskIds)
    syncPlanMembership(tx, { kind: 'tasks', action: 'update', id })
  return { taskIds: [...taskIds], occurrenceIds: [...occurrenceIds] }
}

/**
 * Closes every open interval and pauses its task or occurrence, e.g. when a
 * break starts.
 */
export function pauseOpenWork(tx: ScheduleTx, now: number) {
  const open = tx
    .select()
    .from(timeEntries)
    .where(isNull(timeEntries.end_time))
    .all()
  for (const entry of open)
    pauseInterval(tx, entry.task_id, entry.occurrence_id, now)
  return [...new Set(open.map((entry) => entry.task_id))]
}

/** Closes a task's (or occurrence's) open interval at `at` and pauses it. */
export function pauseInterval(
  tx: ScheduleTx,
  taskId: string,
  occurrenceId: string | null,
  at: number,
) {
  trackInterval(tx, taskId, occurrenceId, ProgressStatus.PAUSED, at)
  if (occurrenceId)
    tx.update(taskOccurrences)
      .set({ status: ProgressStatus.PAUSED })
      .where(eq(taskOccurrences.id, occurrenceId))
      .run()
  else
    tx.update(tasks)
      .set({ status: ProgressStatus.PAUSED })
      .where(
        and(eq(tasks.id, taskId), eq(tasks.status, ProgressStatus.IN_PROGRESS)),
      )
      .run()
  if (!occurrenceId)
    syncPlanMembership(tx, { kind: 'tasks', action: 'update', id: taskId })
}
