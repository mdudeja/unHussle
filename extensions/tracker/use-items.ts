import {
  COLLECTION_PAGE_LIMIT,
  ProgressStatus,
  useExtensionCollections,
  useExtensionContainers,
  type ContainerRequest,
} from 'unhussle/frontend'
import {
  TRACKER_KEY,
  isCounting,
  itemKey,
  toTrackedItem,
  type TrackedItem,
} from './items'

/** Completed and total tasks, for items that don't count units. */
export type TaskCounts = { done: number; total: number }

const countRequests = (item: TrackedItem): ContainerRequest[] => [
  { kind: item.kind, id: item.id, options: { limit: 1 } },
  {
    kind: item.kind,
    id: item.id,
    options: { limit: 1, status: ProgressStatus.COMPLETED },
  },
]

const PAGE = { customKey: TRACKER_KEY, limit: COLLECTION_PAGE_LIMIT }

/**
 * Tracked projects and goals, one page of each, newest first, with task
 * counts for items that don't count units.
 */
export function useItems() {
  const projects = useExtensionCollections('projects', PAGE)
  const goals = useExtensionCollections('goals', PAGE)
  const rows = [
    ...(projects.data?.items ?? []).map((row) => ({
      row,
      item: toTrackedItem('projects', row),
    })),
    ...(goals.data?.items ?? []).map((row) => ({
      row,
      item: toTrackedItem('goals', row),
    })),
  ]
  const items = rows
    .sort((a, b) => b.row.updated_at - a.row.updated_at)
    .map(({ item }) => item)
  const byTasks = items.filter((item) => !isCounting(item))
  const counts = useExtensionContainers(byTasks.flatMap(countRequests))

  const taskCounts = new Map<string, TaskCounts>()
  byTasks.forEach((item, index) => {
    const [all, completed] = (counts.data ?? []).slice(index * 2, index * 2 + 2)
    if (all && completed)
      taskCounts.set(itemKey(item), {
        done: completed.tasks.total,
        total: all.tasks.total,
      })
  })

  return {
    items,
    taskCounts,
    isLoading: projects.isLoading || goals.isLoading,
    error: projects.error ?? goals.error,
    retry: () => {
      void projects.retry()
      void goals.retry()
    },
    isTruncated: [projects.data, goals.data].some(
      (page) => page !== null && page.total > page.items.length,
    ),
  }
}
