import type { CountProgress, ProgressStatus } from 'unhussle/frontend'

/** The tracker's key in an item's `custom_data`: its extension ID. */
export const TRACKER_KEY = 'tracker'
export const RATINGS = [1, 2, 3, 4, 5] as const

export type ItemKind = 'projects' | 'goals'
export const KIND_LABELS: Record<ItemKind, string> = {
  projects: 'Project',
  goals: 'Goal',
}

/** What the tracker saves under `custom_data.tracker`. */
export type TrackerData = { type: string; rating?: number; summary?: string }

/** A tracked project or goal, the same shape for both. */
export type TrackedItem = CountProgress & {
  kind: ItemKind
  id: string
  title: string
  status: ProgressStatus | null
  completed_at: number | null
  custom_data: Record<string, unknown> | null
  tracker: TrackerData
}

type Row = Omit<TrackedItem, 'kind' | 'tracker'>

/** Reads a row's tracker data; a malformed one shows as an unknown type. */
export function toTrackedItem(kind: ItemKind, row: Row): TrackedItem {
  const data = row.custom_data?.[TRACKER_KEY] as Partial<TrackerData> | undefined
  return {
    ...row,
    kind,
    tracker: {
      type: typeof data?.type === 'string' ? data.type : '',
      rating: typeof data?.rating === 'number' ? data.rating : undefined,
      summary: typeof data?.summary === 'string' ? data.summary : undefined,
    },
  }
}

/** Unique across projects and goals, which may share IDs' shapes. */
export const itemKey = ({ kind, id }: Pick<TrackedItem, 'kind' | 'id'>) =>
  `${kind}:${id}`

export const isCounting = (item: TrackedItem) => item.progress_total !== null
