import type { Area, Goal, Project, Tag, Task, TimeEntry } from '@c/types'
import type { Url } from '@d/database/schemas/urls.schema'
import type {
  HydratedProject,
  HydratedArea,
  HydratedGoal,
  HydratedResource,
} from './Hydrated'
import { EntityRefKind } from '@/components/ui/custom/EntityRefBadge'

/** Labels for selectors and badges, independent of loaded entity lists. */
export type EntityReference = {
  id: string
  title: string
  kind?: EntityRefKind
  icon?: string | null
  color?: string | null
  tags?: Pick<Tag['Read'], 'id' | 'title'>[]
}
/** Task table projection: labels, direct tags and open timer intervals only. */
export type TaskListItem = Task['Read'] & {
  project?: EntityReference | null
  area?: EntityReference | null
  goal?: EntityReference | null
  tags?: Tag['Read'][]
  timeEntries?: TimeEntry['Read'][]
}
export type ReadContainerKind = 'projects' | 'areas' | 'goals' | 'tags' | 'urls'

/** The most collections one page returns. */
export const COLLECTION_PAGE_LIMIT = 100
/** Where collections come from: an item and what it holds, or a tag. */
export const COLLECTION_SOURCE_KINDS = [
  'projects',
  'areas',
  'goals',
  'tags',
] as const
export type CollectionSource = {
  kind: (typeof COLLECTION_SOURCE_KINDS)[number]
  id: string
}

/** Sources in a query string: `kind:id` pairs, comma-separated. */
export const encodeSources = (sources: CollectionSource[]) =>
  sources.map(({ kind, id }) => `${kind}:${id}`).join(',')
/** The sources a query string holds, or `null` when one is malformed. */
export function decodeSources(text: string): CollectionSource[] | null {
  const sources = text.split(',').map((pair) => {
    const [kind, id] = pair.split(':')
    return { kind, id } as CollectionSource
  })
  return sources.every(
    ({ kind, id }) => COLLECTION_SOURCE_KINDS.includes(kind) && Boolean(id),
  )
    ? sources
    : null
}

/** Filters for a page of projects, areas or goals. */
export type CollectionListOptions = {
  /** Title or tag match. */
  q?: string
  /** Projects and goals only; areas have no status. */
  status?: string
  /** Holds `custom_data[customKey]`, such as an extension's ID. */
  customKey?: string
  /**
   * Projects or goals in any of these. A project is itself; a goal is
   * itself and its projects; an area is its goals and projects, including
   * its goals' projects; a tag is the projects and goals tagged with it.
   */
  sources?: CollectionSource[]
  cursor?: string
  limit?: number
}
/** Each collection kind's list row, as its list page shows it. */
export type CollectionListItems = {
  projects: HydratedProject
  areas: HydratedArea
  goals: HydratedGoal
}
export type TaskPageOptions = {
  // base64-encoded JSON string of [scope, last.value, last.id]
  cursor?: string
  limit?: number
  q?: string
  status?: string
  priority?: string
  sort?: string
  direction?: string
  is_fun?: string
  is_chore?: string
  is_quick?: string
}
export type ReadPage<T> = {
  items: T[]
  total: number
  nextCursor: string | null
}
export type ContainerDetail = {
  item:
    Project['Read'] | Area['Read'] | Goal['Read'] | Tag['Read'] | Url['Read']
  /** Only direct, editable attachments. Membership is exclusively in tasks. */
  directRelations: {
    projects: HydratedProject[]
    areas: HydratedArea[]
    goals: HydratedGoal[]
    resources: HydratedResource[]
    tags: Tag['Read'][]
    urls: Url['Read'][]
  }
  tasks: ReadPage<TaskListItem>
}
