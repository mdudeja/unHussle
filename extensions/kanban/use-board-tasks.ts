import {
  ProgressStatus,
  useExtensionContainers,
  type ContainerRequest,
} from 'unhussle/frontend'
import type { Board } from './boards'
import { columnFor } from './placement'

/** Paused tasks are fetched too; they show under in-progress stages. */
const FETCHED_STATUSES = [
  ProgressStatus.PLANNED,
  ProgressStatus.IN_PROGRESS,
  ProgressStatus.PAUSED,
  ProgressStatus.COMPLETED,
]
/** The most tasks one source returns per status. */
export const TASKS_PER_STATUS = 100

/** The board's tasks grouped by stage, each task once. */
export function useBoardTasks(board: Board) {
  const requests: ContainerRequest[] = board.sources.flatMap((source) =>
    FETCHED_STATUSES.map((status) => ({
      kind: source.kind,
      id: source.id,
      options: {
        status,
        limit: TASKS_PER_STATUS,
        sort: 'updated_at',
        direction: 'desc',
      },
    })),
  )
  const query = useExtensionContainers(requests)

  const details = query.data ?? []
  const tasks = details.flatMap((detail) => detail.tasks.items)
  type Task = (typeof tasks)[number]
  const columns = board.stages.map((stage) => ({ stage, tasks: [] as Task[] }))
  const seen = new Set<string>()
  for (const task of tasks) {
    if (seen.has(task.id)) continue
    seen.add(task.id)
    columns[columnFor(task, board.stages)]?.tasks.push(task)
  }

  return {
    columns,
    isLoading: query.isLoading,
    error: query.error,
    retry: query.retry,
    isTruncated: details.some(
      (detail) => detail.tasks.total > detail.tasks.items.length,
    ),
  }
}

export type BoardTask = ReturnType<
  typeof useBoardTasks
>['columns'][number]['tasks'][number]
