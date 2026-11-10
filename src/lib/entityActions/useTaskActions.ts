import { Ban, CheckCircle2, Pause, Play } from 'lucide-react'
import { ProgressStatus } from '@c/types/enums'
import type { HydratedTask } from '@c/types/Hydrated'
import { useStore } from '@/store'
import type { OvernightPrompt } from '@/store/slices/createUISlice'
import { overnightStart } from '@/workflows/schedulerHooks'
import {
  cancelTask,
  completeTask,
  pauseTask,
  startTask,
} from '@/workflows/taskCommands'
import type { EntityAction } from './types'

type TaskLike = Pick<HydratedTask, 'id' | 'status' | 'timeEntries'>

/**
 * Work running since an earlier day asks when the user stopped before an
 * action that would count the whole night. Returns whether it asked.
 */
const askedOvernight = (task: TaskLike, then: OvernightPrompt['then']) => {
  const startedAt = overnightStart(task)
  if (startedAt === undefined) return false
  useStore.getState().askOvernight({ taskId: task.id, startedAt, then })
  return true
}

/** Determines whether a task is in a closed state. */
const isClosed = (task: TaskLike) =>
  task.status === ProgressStatus.COMPLETED ||
  task.status === ProgressStatus.CANCELLED

/** Lifecycle actions for a task: start, pause, complete, cancel. */
export const useTaskActions = <T extends TaskLike>(): EntityAction<T>[] => [
  {
    id: 'start',
    label: 'Start',
    icon: Play,
    run: (task) => startTask(task.id),
    isVisible: (task) =>
      !isClosed(task) && task.status !== ProgressStatus.IN_PROGRESS,
  },
  {
    id: 'pause',
    label: 'Pause',
    icon: Pause,
    variant: 'outline',
    run: (task) =>
      askedOvernight(task, 'pause') ? undefined : pauseTask(task.id),
    isVisible: (task) => task.status === ProgressStatus.IN_PROGRESS,
  },
  {
    id: 'complete',
    label: 'Complete',
    icon: CheckCircle2,
    variant: 'outline',
    run: (task) =>
      askedOvernight(task, 'complete') ? undefined : completeTask(task.id),
    isVisible: (task) => !isClosed(task),
  },
  {
    id: 'cancel',
    label: 'Cancel',
    icon: Ban,
    variant: 'outline',
    run: (task) =>
      askedOvernight(task, 'cancel') ? undefined : cancelTask(task.id),
    isVisible: (task) => !isClosed(task),
    confirm: {
      title: 'Cancel this task?',
      description: () =>
        'The task will be marked as cancelled and its timer stopped.',
      confirmLabel: 'Cancel task',
    },
  },
]
