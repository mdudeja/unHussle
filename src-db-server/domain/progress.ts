import { and, eq, isNull } from 'drizzle-orm'
import type { MutationInput } from '@c/workflows/contracts'
import type {
  ProgressItemKind,
  RecordedProgressSession,
} from '@c/scheduler/contracts'
import { ProgressStatus } from '@c/types/enums'
import { addedUnits, countProgressError, doneAfter } from '@c/progress'
import type { ScheduleTx } from '@d/database/repositories/scheduler'
import {
  goals,
  progressSessions,
  projects,
  taskOccurrences,
  tasks,
} from '@d/database/schemas'
import type { PublicationContext } from '@d/workflows/contracts'
import { RuleError } from './errors'

const itemTables = { projects, goals } as const
const itemColumns = {
  projects: progressSessions.project_id,
  goals: progressSessions.goal_id,
} as const

const readItem = (tx: ScheduleTx, kind: ProgressItemKind, id: string) =>
  tx.select().from(itemTables[kind]).where(eq(itemTables[kind].id, id)).get()

/** Checks the stored count fields, regardless of which command wrote them. */
export function validateCountProgress(
  tx: ScheduleTx,
  { kind, id }: MutationInput,
) {
  if ((kind !== 'projects' && kind !== 'goals') || !id) return
  const item = readItem(tx, kind, id)
  if (!item) throw new Error('NOT_FOUND')
  const error = countProgressError(item)
  if (error) throw new RuleError(error)
}

/**
 * The counting items in a task's sessions feed: its project, and its own goal or
 * else its project's goal.
 */
function countingItems(
  tx: ScheduleTx,
  task: { project_id: string | null; goal_id: string | null },
) {
  const project = task.project_id
    ? tx.select().from(projects).where(eq(projects.id, task.project_id)).get()
    : undefined
  const goalId = task.goal_id ?? project?.goal_id ?? null
  const goal = goalId ? readItem(tx, 'goals', goalId) : undefined
  return [
    ...(project?.progress_total != null
      ? [{ kind: 'projects' as const, itemId: project.id }]
      : []),
    ...(goal?.progress_total != null
      ? [{ kind: 'goals' as const, itemId: goal.id }]
      : []),
  ]
}

/**
 * Saves one session per counting item the completed work feeds, once per
 * task or occurrence, and announces them so the user can record the count.
 */
function recordSessions(
  tx: ScheduleTx,
  taskId: string,
  occurrenceId: string | null,
  minutes: number,
  { operationId, announce }: PublicationContext,
) {
  const task = tx.select().from(tasks).where(eq(tasks.id, taskId)).get()
  if (!task) throw new Error('NOT_FOUND')
  const sessions: RecordedProgressSession[] = []
  for (const { kind, itemId } of countingItems(tx, task)) {
    const recorded = tx
      .select({ id: progressSessions.id })
      .from(progressSessions)
      .where(
        and(
          eq(itemColumns[kind], itemId),
          eq(progressSessions.task_id, taskId),
          occurrenceId
            ? eq(progressSessions.occurrence_id, occurrenceId)
            : isNull(progressSessions.occurrence_id),
        ),
      )
      .get()
    if (recorded) continue
    const session = tx
      .insert(progressSessions)
      .values({
        [kind === 'projects' ? 'project_id' : 'goal_id']: itemId,
        task_id: taskId,
        occurrence_id: occurrenceId,
        minutes,
      })
      .returning({ id: progressSessions.id })
      .get()
    sessions.push({ id: session.id, kind, itemId })
  }
  if (sessions.length)
    announce('scheduler.progress.recorded', { operationId, sessions })
}

/** A one-off task completed through a status change. */
export function recordTaskProgress(
  tx: ScheduleTx,
  { kind, id, changes }: MutationInput,
  publication: PublicationContext,
) {
  if (kind !== 'tasks' || !id || changes?.status !== ProgressStatus.COMPLETED)
    return
  const task = tx.select().from(tasks).where(eq(tasks.id, id)).get()
  if (!task) throw new Error('NOT_FOUND')
  // Completing a recurring task ends the habit; its occurrences are the sessions.
  if (task.is_recurring) return
  recordSessions(tx, id, null, task.spent_minutes, publication)
}

/** A recurring task's occurrence completed. */
export function recordOccurrenceProgress(
  tx: ScheduleTx,
  id: string,
  status: ProgressStatus,
  publication: PublicationContext,
) {
  if (status !== ProgressStatus.COMPLETED) return
  const occurrence = tx
    .select()
    .from(taskOccurrences)
    .where(eq(taskOccurrences.id, id))
    .get()
  if (!occurrence?.taskId)
    throw new Error('Occurrence not found; save its day first')
  recordSessions(
    tx,
    occurrence.taskId,
    id,
    occurrence.spentMinutes,
    publication,
  )
}

/**
 * Records the value the user entered for each session: the position reached
 * or the amount done, as the item records it. A session is recorded once.
 */
export function logProgress(
  tx: ScheduleTx,
  values: { sessionId: string; value: number }[],
  { operationId, announce }: PublicationContext,
) {
  const changed: Record<ProgressItemKind, string[]> = {
    projects: [],
    goals: [],
  }
  const logged = values.map(({ sessionId, value }) => {
    const session = tx
      .select()
      .from(progressSessions)
      .where(eq(progressSessions.id, sessionId))
      .get()
    if (!session) throw new RuleError('This session no longer exists')
    if (session.amount !== null)
      throw new RuleError('This session is already recorded')
    const kind: ProgressItemKind = session.project_id ? 'projects' : 'goals'
    const itemId = session.project_id ?? session.goal_id
    const item = itemId ? readItem(tx, kind, itemId) : undefined
    if (!item) throw new Error('NOT_FOUND')
    if (item.progress_total === null || item.progress_input === null)
      throw new RuleError(`${item.title} doesn't count progress`)
    if (!Number.isInteger(value)) throw new RuleError('Enter a whole number')
    const done = doneAfter(item.progress_input, item.progress_done, value)
    const error = countProgressError({ ...item, progress_done: done })
    if (error) throw new RuleError(error)
    tx.update(itemTables[kind])
      .set({ progress_done: done })
      .where(eq(itemTables[kind].id, item.id))
      .run()
    changed[kind].push(item.id)
    return tx
      .update(progressSessions)
      .set({
        amount: addedUnits(item.progress_input, item.progress_done, value),
      })
      .where(eq(progressSessions.id, sessionId))
      .returning()
      .get()
  })
  for (const kind of ['projects', 'goals'] as const)
    if (changed[kind].length)
      announce(`${kind}.change`, {
        kind,
        action: 'update',
        attachedIds: [...new Set(changed[kind])],
        operationId,
        result: undefined,
      })
  return logged
}
