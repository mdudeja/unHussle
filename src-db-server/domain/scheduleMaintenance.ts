import { and, eq, inArray } from 'drizzle-orm'
import { occursOn } from '@c/scheduler/preparation'
import { isPending, pendingStatuses } from '@c/scheduler/status'
import { ProgressStatus } from '@c/types/enums'
import type { EntryKind, MutationInput } from '@c/workflows/contracts'
import {
  bumpRevisions,
  type ScheduleTx,
} from '@d/database/repositories/scheduler'
import {
  dayPlans,
  planItems,
  taskOccurrences,
  tasks,
} from '@d/database/schemas'

/** Fields whose changes can alter a saved stack; anything else is read live. */
const scheduleFields: Partial<Record<EntryKind, readonly string[]>> = {
  tasks: [
    'status',
    'priority',
    'project_id',
    'goal_id',
    'area_id',
    'anchor_id',
    'anchor_type',
    'anchor_slot',
    'estimated_minutes',
    'due_date',
    'is_recurring',
    'recurrance_rule',
    'is_fun',
    'is_chore',
    'is_quick',
    'scheduled_start',
    'scheduled_end',
    'tags',
  ],
  projects: ['priority', 'goal_id', 'area_id', 'tags'],
  goals: ['priority', 'area_id', 'tags'],
  areas: ['priority', 'tags'],
}

/** Whether a mutation should mark current and future plans for review. */
export function affectsSchedules({ kind, action, changes }: MutationInput) {
  if (kind === 'tags') return true
  const fields = scheduleFields[kind]
  if (!fields) return false
  if (action === 'update')
    return Object.keys(changes ?? {}).some((key) => fields.includes(key))
  // New collections have no members yet; deleting one changes its members.
  return kind === 'tasks' || action !== 'create'
}

/**
 * Keeps saved plans consistent with changed tasks: one-off rows follow their
 * task's status, and occurrences no longer produced by a task are cancelled.
 */
export function syncPlanMembership(tx: ScheduleTx, input: MutationInput) {
  if (input.kind !== 'tasks' || input.action === 'create') return
  const ids = [
    ...new Set([...(input.attachedIds ?? []), ...(input.id ? [input.id] : [])]),
  ]
  if (!ids.length) return
  const byId = new Map(
    tx
      .select()
      .from(tasks)
      .where(inArray(tasks.id, ids))
      .all()
      .map((task) => [task.id, task]),
  )
  const rows = tx
    .select()
    .from(planItems)
    .where(
      and(
        inArray(planItems.sourceTaskId, ids),
        inArray(planItems.status, pendingStatuses),
      ),
    )
    .all()
  const changedPlans: string[] = []
  const setStatus = (row: (typeof rows)[number], status: string) => {
    if (row.status === status) return
    tx.update(planItems).set({ status }).where(eq(planItems.id, row.id)).run()
    changedPlans.push(row.planId)
  }
  for (const row of rows) {
    const task = byId.get(row.sourceTaskId)
    // Occurrence rows keep their status in task_occurrences.
    if (!task) setStatus(row, ProgressStatus.CANCELLED)
    else if (!row.occurrenceId)
      setStatus(row, task.status ?? ProgressStatus.PLANNED)
  }

  const occurrences = tx
    .select({
      id: taskOccurrences.id,
      sourceTaskId: taskOccurrences.sourceTaskId,
      date: taskOccurrences.date,
      slot: taskOccurrences.slot,
      status: taskOccurrences.status,
      timezone: dayPlans.timezone,
    })
    .from(taskOccurrences)
    .leftJoin(planItems, eq(planItems.occurrenceId, taskOccurrences.id))
    .leftJoin(dayPlans, eq(dayPlans.id, planItems.planId))
    .where(
      and(
        inArray(taskOccurrences.sourceTaskId, ids),
        inArray(taskOccurrences.status, pendingStatuses),
      ),
    )
    .all()
  const cancelled = new Set<string>()
  const removed = new Set<string>()
  for (const occurrence of occurrences) {
    const task = byId.get(occurrence.sourceTaskId)
    if (!task || !task.is_recurring || !isPending(task.status ?? 'planned'))
      cancelled.add(occurrence.id)
    else if (
      // Untouched occurrences follow recurrence edits; started ones are history.
      occurrence.status === 'planned' &&
      !occursOn(
        task,
        occurrence.date,
        occurrence.timezone ?? 'UTC',
        occurrence.slot,
      )
    )
      removed.add(occurrence.id)
  }
  if (cancelled.size)
    tx.update(taskOccurrences)
      .set({ status: ProgressStatus.CANCELLED })
      .where(inArray(taskOccurrences.id, [...cancelled]))
      .run()
  if (removed.size) {
    const affected = tx
      .select({ planId: planItems.planId })
      .from(planItems)
      .where(inArray(planItems.occurrenceId, [...removed]))
      .all()
    tx.update(planItems)
      .set({ status: ProgressStatus.CANCELLED })
      .where(inArray(planItems.occurrenceId, [...removed]))
      .run()
    tx.delete(taskOccurrences)
      .where(inArray(taskOccurrences.id, [...removed]))
      .run()
    changedPlans.push(...affected.map((row) => row.planId))
  }
  bumpRevisions(tx, changedPlans)
}
