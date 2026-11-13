import type { AdjustAction, DayPlan, PlanEntry } from '@c/scheduler/contracts'
import { ProgressStatus } from '@c/types/enums'
import type { getFrontendRuntime } from '@/bootstrap'
import { completeTask, pauseTask, startTask } from '@/workflows/taskCommands'

type Runtime = ReturnType<typeof getFrontendRuntime>

export type EntryTransition =
  ProgressStatus.IN_PROGRESS | ProgressStatus.PAUSED | ProgressStatus.COMPLETED

const taskTransitions = {
  [ProgressStatus.IN_PROGRESS]: startTask,
  [ProgressStatus.PAUSED]: pauseTask,
  [ProgressStatus.COMPLETED]: completeTask,
}

/** Starts, pauses or completes an entry: its occurrence if recurring, else its task. */
export const transitionEntry = async (
  runtime: Runtime,
  entry: Pick<PlanEntry, 'taskId' | 'occurrenceId'>,
  status: EntryTransition,
) => {
  if (entry.occurrenceId) {
    await runtime.commands.execute('scheduler.occurrence.transition', {
      id: entry.occurrenceId,
      status,
    })
    return
  }
  await taskTransitions[status](entry.taskId)
}

/** Reorders, pins or postpones an entry within its saved day plan. */
export const adjustEntry = async (
  runtime: Runtime,
  plan: Pick<DayPlan, 'date' | 'timezone' | 'revision'>,
  entry: Pick<PlanEntry, 'id'>,
  action: AdjustAction,
  options: { until?: string; position?: number } = {},
) => {
  await runtime.commands.execute('scheduler.adjust', {
    date: plan.date,
    timezone: plan.timezone,
    revision: plan.revision,
    itemId: entry.id,
    action,
    ...options,
  })
}
