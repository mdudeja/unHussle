import { useState } from 'react'
import { ProgressStatus } from 'unhussle/frontend'
import { useTracker } from './api-context'
import {
  TRACKER_KEY,
  itemKey,
  type TrackerData,
  type TrackerItem,
} from './items'

type Failure = { key: string; message: string }
type Item = Pick<TrackerItem, 'kind' | 'id'>

/**
 * A habit task counts for the next item of the same kind: a project's task
 * keeps its goal, a goal's task keeps its project.
 */
export const linkChanges = (to: Item) =>
  to.kind === 'projects' ? { project_id: to.id } : { goal_id: to.id }

/**
 * Changes the tracker makes to existing projects, goals and tasks: status,
 * its own custom data, and habit task links. It never creates either.
 */
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

  return {
    isPending: (key: string) => pendingKeys.includes(key),
    errorFor: (key: string) =>
      failure?.key === key ? failure.message : undefined,
    /** Failures show on the item's card. */
    move: async (item: TrackerItem, status: ProgressStatus) => {
      const key = itemKey(item)
      setPendingKeys((keys) => [...keys, key])
      setFailure((current) => (current?.key === key ? null : current))
      try {
        await change(item, { status })
      } catch (error) {
        api.log.error('Could not move a tracked item', error)
        setFailure({ key, message: 'Could not move this item. Try again.' })
      } finally {
        setPendingKeys((keys) => keys.filter((other) => other !== key))
      }
    },
    /** Throws, so the dialog can show the failure. */
    finish: async (
      item: TrackerItem,
      result: TrackerData,
      handOver?: { taskIds: string[]; to: Item },
    ) => {
      await change(item, {
        status: ProgressStatus.COMPLETED,
        custom_data: { [TRACKER_KEY]: { ...item.tracker, ...result } },
      })
      if (!handOver) return
      for (const id of handOver.taskIds)
        await api.services.execute('entity.change', {
          kind: 'tasks',
          action: 'update',
          id,
          changes: linkChanges(handOver.to),
        })
    },
  }
}
