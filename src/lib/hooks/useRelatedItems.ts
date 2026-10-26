import { useEffect, useState } from 'react'
import { useStore } from '@/store'
import { entityRegistry } from '@/lib/entityActions'
import { TagsService, TaggedItems } from '@/services/database/TagsService'
import { Task } from '@c/types/index'
import { Logger } from '@c/Logger'

type Loadable<T> = { data: T | null; isLoading: boolean }

// Loads `load()` whenever `deps` change. Previous data stays visible while a
// reload is in flight so tables don't flash empty after every edit.
const useLoad = <T>(
  load: () => Promise<T>,
  deps: unknown[],
  description: string,
): Loadable<T> => {
  // `loadedFor` holds the deps the current data was loaded for; while they differ
  // from `deps`, a load is in flight.
  const [state, setState] = useState<{
    data: T | null
    loadedFor: unknown[] | null
  }>({ data: null, loadedFor: null })

  useEffect(() => {
    let isCurrent = true
    load()
      .then((data) => {
        if (isCurrent) {
          setState({ data, loadedFor: deps })
        }
      })
      .catch((error) => {
        Logger.getInstance().error(
          `Failed to load ${description}: ${String(error)}`,
        )
        if (isCurrent) {
          setState((prev) => ({ ...prev, loadedFor: deps }))
        }
      })
    return () => {
      isCurrent = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const isLoading =
    state.loadedFor === null ||
    state.loadedFor.length !== deps.length ||
    state.loadedFor.some((dep, i) => !Object.is(dep, deps[i]))
  return { data: state.data, isLoading }
}

// Prefer the store's copy of each row; it reflects edits made since loading.
// Store rows come from the same endpoints, so they are hydrated too.
const withStoreCopies = <T extends { id: string }>(
  rows: T[],
  getById: (id: string) => { id: string } | null,
) => rows.map((row) => (getById(row.id) as T | null) ?? row)

/** Tasks belonging to an area, project or goal. Reloads when tasks change. */
export const useRelatedTasks = (
  kind: 'areas' | 'projects' | 'goals',
  id: string,
): Loadable<Task['Read'][]> => {
  const tasks = useStore((state) => state.tasks)
  const { data, isLoading } = useLoad(
    async () => {
      const parent = await entityRegistry[kind].service.fetchById(id)
      return (parent as { tasks?: Task['Read'][] }).tasks ?? []
    },
    [kind, id, tasks.data],
    `tasks of ${kind} ${id}`,
  )
  return {
    data: data && withStoreCopies(data, tasks.getById),
    isLoading,
  }
}

/** Tasks, projects, areas and goals tagged with tag `id`. */
export const useTaggedItems = (id: string): Loadable<TaggedItems> => {
  const tasks = useStore((state) => state.tasks)
  const projects = useStore((state) => state.projects)
  const areas = useStore((state) => state.areas)
  const goals = useStore((state) => state.goals)
  const { data, isLoading } = useLoad(
    () => TagsService.getInstance().fetchItems(id),
    [id, tasks.data, projects.data, areas.data, goals.data],
    `items tagged ${id}`,
  )
  return {
    data: data && {
      tasks: withStoreCopies(data.tasks, tasks.getById),
      projects: withStoreCopies(data.projects, projects.getById),
      areas: withStoreCopies(data.areas, areas.getById),
      goals: withStoreCopies(data.goals, goals.getById),
    },
    isLoading,
  }
}
