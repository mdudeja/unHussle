import { useState } from 'react'
import { ProgressStatus, type ProgressInput } from 'unhussle/frontend'
import { useTracker } from './api-context'
import {
  TRACKER_KEY,
  itemKey,
  type ItemKind,
  type TrackedItem,
  type TrackerData,
} from './items'

type Failure = { key: string; message: string }
type Item = Pick<TrackedItem, 'kind' | 'id'>

export type NewItem = {
  kind: ItemKind
  title: string
  type: string
  /** Counting needs a total; without one, progress is the item's tasks. */
  count?: { total: number; unit: string; input: ProgressInput }
  /** Tasks, such as a daily "Read", that count for the new item. */
  taskIds: string[]
}

/** The task changes that make it count for `target` instead. */
export const linkChanges = (target: Item) =>
  target.kind === 'projects'
    ? { project_id: target.id }
    : { goal_id: target.id, project_id: null }

/** Saves tracker changes and tracks which items are busy or failed. */
export function useItemChanges() {
  const { api } = useTracker()
  const [pendingKeys, setPendingKeys] = useState<string[]>([])
  const [failure, setFailure] = useState<Failure | null>(null)

  const change = (item: Item, changes: Record<string, unknown>) =>
    api.services.execute('entityCollection.change', {
      kind: item.kind,
      action: 'update',
      id: item.id,
      changes,
    })
  const linkTasks = async (taskIds: string[], target: Item) => {
    for (const id of taskIds)
      await api.services.execute('entity.change', {
        kind: 'tasks',
        action: 'update',
        id,
        changes: linkChanges(target),
      })
  }

  /** Runs one change for an item; failures show on its card. */
  const run = async (item: Item, what: string, work: () => Promise<unknown>) => {
    const key = itemKey(item)
    setPendingKeys((keys) => [...keys, key])
    setFailure((current) => (current?.key === key ? null : current))
    try {
      await work()
    } catch (error) {
      api.log.error(`Could not ${what} a tracked item`, error)
      setFailure({ key, message: `Could not ${what} this item. Try again.` })
    } finally {
      setPendingKeys((keys) => keys.filter((other) => other !== key))
    }
  }

  return {
    isPending: (key: string) => pendingKeys.includes(key),
    errorFor: (key: string) =>
      failure?.key === key ? failure.message : undefined,
    move: (item: TrackedItem, status: ProgressStatus) =>
      run(item, 'move', () => change(item, { status })),
    stopTracking: (item: TrackedItem) =>
      run(item, 'stop tracking', () =>
        change(item, { custom_data: { [TRACKER_KEY]: null } }),
      ),
    /** Throws, so the dialog can show the failure. */
    finish: async (
      item: TrackedItem,
      result: Pick<TrackerData, 'rating' | 'summary'>,
      handOver?: { taskIds: string[]; to: Item },
    ) => {
      await change(item, {
        status: ProgressStatus.COMPLETED,
        custom_data: { [TRACKER_KEY]: { ...item.tracker, ...result } },
      })
      if (handOver) await linkTasks(handOver.taskIds, handOver.to)
    },
    /** Throws, so the dialog can show the failure. */
    create: async ({ kind, title, type, count, taskIds }: NewItem) => {
      const created = await api.services.execute('entityCollection.add', {
        kind,
        action: 'create',
        changes: {
          title,
          custom_data: { [TRACKER_KEY]: { type } },
          ...(count && {
            progress_total: count.total,
            progress_unit: count.unit,
            progress_input: count.input,
          }),
        },
      })
      if (!created) throw new Error('The item was not created')
      await linkTasks(taskIds, { kind, id: created.id })
    },
  }
}
