import { Priority, ProgressStatus } from 'unhussle/frontend'
import type { TrackerItem } from './items'

const PRIORITY_ORDER = [Priority.HIGH, Priority.MEDIUM, Priority.LOW]
const rank = (priority: Priority | null) =>
  priority === null ? PRIORITY_ORDER.length : PRIORITY_ORDER.indexOf(priority)

/**
 * Where a finished item's habit tasks can go, best first: unstarted items
 * of the same kind on the tracker, under the same parent (a project's goal,
 * a goal's area), or sharing a tag when it has no parent.
 */
export function nextItems(item: TrackerItem, items: TrackerItem[]) {
  return items
    .filter(
      (other) =>
        other.kind === item.kind &&
        other.id !== item.id &&
        other.status === ProgressStatus.PLANNED &&
        (item.parentId
          ? other.parentId === item.parentId
          : other.tagIds.some((tag) => item.tagIds.includes(tag))),
    )
    .sort(
      (a, b) =>
        (a.due_date ?? Infinity) - (b.due_date ?? Infinity) ||
        rank(a.priority) - rank(b.priority) ||
        a.created_at - b.created_at,
    )
}
