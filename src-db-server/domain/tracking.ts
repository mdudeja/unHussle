import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { MINUTE_MS } from '@c/datetimeUtils'
import { ProgressStatus } from '@c/types/enums'
import type { ScheduleTx } from '@d/database/repositories/scheduler'
import {
  areas,
  goals,
  junctionTimeEntries,
  projects,
  taskOccurrences,
  tasks,
  timeEntries,
} from '@d/database/schemas'
import { syncPlanMembership } from './scheduleMaintenance'

const present = (ids: (string | null | undefined)[]) =>
  [...new Set(ids)].filter((id): id is string => Boolean(id))

/**
 * Adds closed time to every collection that holds the task right now, the
 * way their pages count tasks: its project; its goal and its project's goal;
 * its area and those of its project and goals. Counting when time closes
 * keeps it where it was spent, even after the task moves on.
 */
function addCollectionTime(tx: ScheduleTx, taskId: string, minutes: number) {
  if (minutes <= 0) return
  const task = tx
    .select({
      project_id: tasks.project_id,
      goal_id: tasks.goal_id,
      area_id: tasks.area_id,
      project_goal_id: projects.goal_id,
      project_area_id: projects.area_id,
    })
    .from(tasks)
    .leftJoin(projects, eq(projects.id, tasks.project_id))
    .where(eq(tasks.id, taskId))
    .get()
  if (!task) return
  const goalIds = present([task.goal_id, task.project_goal_id])
  const goalAreas = goalIds.length
    ? tx
        .select({ area_id: goals.area_id })
        .from(goals)
        .where(inArray(goals.id, goalIds))
        .all()
    : []
  const areaIds = present([
    task.area_id,
    task.project_area_id,
    ...goalAreas.map(({ area_id }) => area_id),
  ])
  const add = (table: typeof projects | typeof goals | typeof areas) =>
    sql`coalesce(${table.spent_minutes}, 0) + ${minutes}`
  if (task.project_id)
    tx.update(projects)
      .set({ spent_minutes: add(projects) })
      .where(eq(projects.id, task.project_id))
      .run()
  if (goalIds.length)
    tx.update(goals)
      .set({ spent_minutes: add(goals) })
      .where(inArray(goals.id, goalIds))
      .run()
  if (areaIds.length)
    tx.update(areas)
      .set({ spent_minutes: add(areas) })
      .where(inArray(areas.id, areaIds))
      .run()
}

/**
 * Tracking intervals are the source of daily accounting. Starting work closes
 * (and pauses) every other open interval; any other status closes its own.
 * Closed time is added to the cumulative task, occurrence and collection
 * totals.
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
    addCollectionTime(tx, entry.task_id, minutes)
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
