import type { CollectionSource } from 'unhussle/frontend'
import { TRACKER_TYPES, type TrackerTypeId } from './tracker-types'

export const SOURCE_KINDS = ['projects', 'areas', 'goals', 'tags'] as const

/**
 * A saved view of projects and goals. Its sources resolve live: an area
 * holds its goals and projects, a tag the projects and goals tagged with it.
 */
export type Tracker = {
  id: string
  name: string
  type: TrackerTypeId
  /** With titles, to show them without another read. */
  sources: (CollectionSource & { title: string })[]
}

export const newTracker = (): Tracker => ({
  id: crypto.randomUUID(),
  name: '',
  type: TRACKER_TYPES[0].id,
  sources: [],
})

export type TrackerErrors = { name?: string; sources?: string }

export const trackerErrors = (tracker: Tracker): TrackerErrors => ({
  name: tracker.name.trim() ? undefined : 'Enter a tracker name.',
  sources: tracker.sources.length
    ? undefined
    : 'Pick at least one project, area, goal or tag.',
})

const isTracker = (value: unknown): value is Tracker => {
  if (typeof value !== 'object' || value === null) return false
  const { id, name, type, sources } = value as Record<string, unknown>
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    TRACKER_TYPES.some((known) => known.id === type) &&
    Array.isArray(sources) &&
    sources.every(
      (source: Record<string, unknown>) =>
        SOURCE_KINDS.includes(source?.kind as (typeof SOURCE_KINDS)[number]) &&
        typeof source.id === 'string' &&
        typeof source.title === 'string',
    )
  )
}

/** The saved trackers; throws when the setting has another shape. */
export function parseTrackers(value: unknown): Tracker[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every(isTracker))
    throw new Error('The saved trackers are not valid')
  return value
}
