import {
  ProgressStatus,
  useExtensionContainers,
  type ContainerRequest,
} from 'unhussle/frontend'
import type { Board } from './boards'

/** Paused tasks are fetched too; they show under in-progress stages. */
const FETCHED_STATUSES = [
  ProgressStatus.PLANNED,
  ProgressStatus.IN_PROGRESS,
  ProgressStatus.PAUSED,
  ProgressStatus.COMPLETED,
]
/** The most tasks one source returns per status. */
export const TASKS_PER_STATUS = 100

/** The board's tasks, each once. */
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
  const seen = new Set<string>()
  const tasks = details
    .flatMap((detail) => detail.tasks.items)
    .filter((task) => {
      if (seen.has(task.id)) return false
      seen.add(task.id)
      return true
    })

  return {
    tasks,
    isLoading: query.isLoading,
    error: query.error,
    retry: query.retry,
    isTruncated: details.some(
      (detail) => detail.tasks.total > detail.tasks.items.length,
    ),
  }
}

export type BoardTask = ReturnType<typeof useBoardTasks>['tasks'][number]
