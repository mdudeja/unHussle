import { Ban, CheckCircle2, Pause, Play } from 'lucide-react'
import { ProgressStatus, Task } from '@c/types/index'
import {
  cancelTask,
  completeTask,
  pauseTask,
  startTask,
} from '@/workflows/taskCommands'
import type { EntityAction } from './types'

type TaskLike = Pick<Task['Read'], 'id' | 'status'>

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
    run: (task) => pauseTask(task.id),
    isVisible: (task) => task.status === ProgressStatus.IN_PROGRESS,
  },
  {
    id: 'complete',
    label: 'Complete',
    icon: CheckCircle2,
    variant: 'outline',
    run: (task) => completeTask(task.id),
    isVisible: (task) => !isClosed(task),
  },
  {
    id: 'cancel',
    label: 'Cancel',
    icon: Ban,
    variant: 'outline',
    run: (task) => cancelTask(task.id),
    isVisible: (task) => !isClosed(task),
    confirm: {
      title: 'Cancel this task?',
      description: () =>
        'The task will be marked as cancelled and its timer stopped.',
      confirmLabel: 'Cancel task',
    },
  },
]
