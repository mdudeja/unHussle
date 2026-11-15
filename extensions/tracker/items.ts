import type { CountProgress, Priority, ProgressStatus } from 'unhussle/frontend'

/** The tracker's key in an item's `custom_data`: its extension ID. */
export const TRACKER_KEY = 'tracker'
export const RATINGS = [1, 2, 3, 4, 5] as const

export type ItemKind = 'projects' | 'goals'
export const KIND_LABELS: Record<ItemKind, string> = {
  projects: 'Project',
  goals: 'Goal',
}

/** What Finish saves under `custom_data.tracker`, shared by every tracker. */
export type TrackerData = { rating?: number; summary?: string }

/** A project or goal on a tracker, the same shape for both. */
export type TrackerItem = CountProgress & {
  kind: ItemKind
  id: string
  title: string
  status: ProgressStatus | null
  priority: Priority | null
  due_date: number | null
  created_at: number
  updated_at: number
  completed_at: number | null
  /** Tracked time spent here, in minutes. */
  spent_minutes: number | null
  /** What a handoff stays within: a project's goal, a goal's area. */
  parentId: string | null
  tagIds: string[]
  custom_data: Record<string, unknown> | null
  tracker: TrackerData
}

type Row = Omit<TrackerItem, 'kind' | 'parentId' | 'tagIds' | 'tracker'> & {
  area_id: string | null
  goal_id?: string | null
  tags?: { id: string }[]
}

/** Reads a project or goal row; malformed tracker data is left out. */
export function toTrackerItem(kind: ItemKind, row: Row): TrackerItem {
  const { area_id, goal_id, tags, ...rest } = row
  const data = row.custom_data?.[TRACKER_KEY] as
    Partial<TrackerData> | undefined
  return {
    ...rest,
    kind,
    parentId: (kind === 'projects' ? goal_id : area_id) ?? null,
    tagIds: (tags ?? []).map(({ id }) => id),
    tracker: {
      rating: typeof data?.rating === 'number' ? data.rating : undefined,
      summary: typeof data?.summary === 'string' ? data.summary : undefined,
    },
  }
}

/** Unique across projects and goals. */
export const itemKey = ({ kind, id }: Pick<TrackerItem, 'kind' | 'id'>) =>
  `${kind}:${id}`

export const isCounting = (item: TrackerItem) => item.progress_total !== null
