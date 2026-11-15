import {
  COLLECTION_PAGE_LIMIT,
  ProgressStatus,
  useExtensionCollections,
  useExtensionContainers,
  type ContainerRequest,
} from 'unhussle/frontend'
import { isCounting, itemKey, toTrackerItem, type TrackerItem } from './items'
import type { Tracker } from './trackers'

/** Completed and total tasks, for items that don't count units. */
export type TaskCounts = { done: number; total: number }

const countRequests = (item: TrackerItem): ContainerRequest[] => [
  { kind: item.kind, id: item.id, options: { limit: 1 } },
  {
    kind: item.kind,
    id: item.id,
    options: { limit: 1, status: ProgressStatus.COMPLETED },
  },
]

/**
 * The projects and goals a tracker's sources hold, one page of each, newest
 * first, with task counts for items that don't count units.
 */
export function useTrackerItems(tracker: Tracker) {
  const options = {
    sources: tracker.sources.map(({ kind, id }) => ({ kind, id })),
    limit: COLLECTION_PAGE_LIMIT,
  }
  const projects = useExtensionCollections('projects', options)
  const goals = useExtensionCollections('goals', options)
  const items = [
    ...(projects.data?.items ?? []).map((row) =>
      toTrackerItem('projects', row),
    ),
    ...(goals.data?.items ?? []).map((row) => toTrackerItem('goals', row)),
  ].sort((a, b) => b.updated_at - a.updated_at)
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
    countsError: counts.error,
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
