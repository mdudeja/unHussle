import { and, eq, isNull, sql } from 'drizzle-orm'
import { ProgressStatus } from '@c/types/enums'
import { validateRecurrence } from '@c/scheduler/validation'
import { validateTaskSchedule } from '@c/taskSchedule'
import { isPending } from '@c/scheduler/status'
import type { ScheduleTx } from '@d/database/repositories/scheduler'
import { validateTaskAnchors } from '@d/database/repositories/scheduler'
import { tasks, taskOccurrences, timeEntries } from '@d/database/schemas'
import type { MutationInput } from '@c/workflows/contracts'
import type { PublicationContext } from '@d/workflows/contracts'
import { trackInterval, pauseInterval } from './tracking'

const statuses = new Set<string>(Object.values(ProgressStatus))
/** Determines whether a value represents a valid progress status. */
const isProgressStatus = (value: unknown): value is ProgressStatus =>
  typeof value === 'string' && statuses.has(value)

/** Announces that the specified tasks have changed, notifying listeners of task updates. */
export function announceTaskChanges(
  taskIds: string[],
  { operationId, announce }: PublicationContext,
) {
  const attachedIds = [...new Set(taskIds)]
  if (attachedIds.length)
    announce('tasks.change', {
      kind: 'tasks',
      action: 'update',
      attachedIds,
      operationId,
      result: undefined,
    })
}

/** Validate the stored task, regardless of which command wrote it. */
export function validateTask(
  tx: ScheduleTx,
  { kind, id, changes }: MutationInput,
) {
  if (kind !== 'tasks' || !id) return
  if (changes && 'status' in changes && !isProgressStatus(changes.status))
    throw new Error('Invalid task status')
  const task = tx.select().from(tasks).where(eq(tasks.id, id)).get()
  if (!task) throw new Error('NOT_FOUND')
  if (task.status !== null && !isProgressStatus(task.status))
    throw new Error('Invalid task status')
  validateRecurrence(task)
  const error = validateTaskSchedule(task)
  if (error) throw new Error(error)
  validateTaskAnchors(tx, task)
}

/** One transaction owns the transition, competing intervals and lifecycle times. */
export function trackTaskTransition(
  tx: ScheduleTx,
  { kind, id, changes }: MutationInput,
  at: number,
  { operationId, announce }: PublicationContext,
) {
  const status = changes?.status
  if (kind !== 'tasks' || !id || status === undefined) return
  if (!isProgressStatus(status)) throw new Error('Invalid task status')
  const affected = trackInterval(tx, id, null, status, at)
  if (status === ProgressStatus.IN_PROGRESS)
    tx.update(tasks)
      .set({ started_at: sql`coalesce(${tasks.started_at}, ${at})` })
      .where(eq(tasks.id, id))
      .run()
  if (status === ProgressStatus.COMPLETED)
    tx.update(tasks).set({ completed_at: at }).where(eq(tasks.id, id)).run()

  announceTaskChanges(
    affected.taskIds.filter((taskId) => taskId !== id),
    { operationId, announce },
  )
  if (affected.occurrenceIds.length)
    announce('scheduler.occurrence.changed', { operationId })
}

/** Occurrences share the same tracking coordinator as one-off tasks. */
export function transitionOccurrence(
  tx: ScheduleTx,
  id: string,
  status: ProgressStatus,
) {
  const occurrence = tx
    .select()
    .from(taskOccurrences)
    .where(eq(taskOccurrences.id, id))
    .get()
  if (!occurrence?.taskId)
    throw new Error('Occurrence not found; save its day first')
  const task = tx
    .select({ recurring: tasks.is_recurring, status: tasks.status })
    .from(tasks)
    .where(eq(tasks.id, occurrence.taskId))
    .get()
  if (!task?.recurring || !isPending(task.status ?? ProgressStatus.PLANNED))
    throw new Error('This recurring task is no longer active')
  if (!Object.values(ProgressStatus).includes(status))
    throw new Error('Invalid occurrence status')
  if (status === ProgressStatus.IN_PROGRESS && !isPending(occurrence.status))
    throw new Error('This occurrence has already ended')
  tx.update(taskOccurrences)
    .set({ status })
    .where(eq(taskOccurrences.id, id))
    .run()
}

/** Records a task occurrences transition to a new progress status and propagates any resulting schedule changes to affected tasks. */
export function trackOccurrenceTransition(
  tx: ScheduleTx,
  id: string,
  status: ProgressStatus,
  at: number,
  publication: PublicationContext,
) {
  const occurrence = tx
    .select()
    .from(taskOccurrences)
    .where(eq(taskOccurrences.id, id))
    .get()
  if (!occurrence?.taskId)
    throw new Error('Occurrence not found; save its day first')
  const affected = trackInterval(tx, occurrence.taskId, id, status, at)
  announceTaskChanges([occurrence.taskId, ...affected.taskIds], publication)
  return tx
    .select()
    .from(taskOccurrences)
    .where(eq(taskOccurrences.id, id))
    .get()
}

/** The UI resolves overnight choices; this service validates the chosen instant. */
export function stopTracking(
  tx: ScheduleTx,
  taskId: string,
  occurrenceId: string | null,
  at: number,
  now: number,
  publication: PublicationContext,
) {
  const open = tx
    .select()
    .from(timeEntries)
    .where(
      and(
        isNull(timeEntries.end_time),
        eq(timeEntries.task_id, taskId),
        occurrenceId === null
          ? isNull(timeEntries.occurrence_id)
          : eq(timeEntries.occurrence_id, occurrenceId),
      ),
    )
    .get()
  if (!open) throw new Error('This task is no longer running')
  if (!Number.isFinite(at) || at < open.start_time || at > now)
    throw new Error('Choose a time between when you started and now')
  pauseInterval(tx, taskId, occurrenceId, at)
  announceTaskChanges([taskId], publication)
  return tx.select().from(timeEntries).where(eq(timeEntries.id, open.id)).get()
}
