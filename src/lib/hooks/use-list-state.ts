import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { entitySearchParams } from '@/lib/entityRoutes'
import {
  initialListState,
  ListSort,
  ListState,
  patchListState,
} from '@/lib/list-view'

export type ListStateControl = {
  state: ListState
  update: (patch: Partial<ListState>) => void
}

const DESC = 'desc'
const ASC = 'asc'

/**
 * List state kept in the URL, so refresh and Back restore it. Filters use
 * their id as the param name (e.g. `?status=planned`).
 */
export function useUrlListState(
  filterIds: string[],
  initialSort: ListSort,
): ListStateControl {
  const [searchParams, setSearchParams] = useSearchParams()
  const { search, sort, dir, page } = entitySearchParams
  const pageParam = Number(searchParams.get(page))
  const state: ListState = {
    q: searchParams.get(search) ?? '',
    filters: Object.fromEntries(
      filterIds.flatMap((id) => {
        const value = searchParams.get(id)
        return value ? [[id, value]] : []
      }),
    ),
    sort: searchParams.get(sort) ?? initialSort.sort,
    desc: searchParams.has(dir)
      ? searchParams.get(dir) === DESC
      : initialSort.desc,
    page: Number.isInteger(pageParam) && pageParam > 1 ? pageParam : 1,
  }

  const update = (patch: Partial<ListState>) => {
    const next = patchListState(state, patch)
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        const set = (name: string, value: string | null) =>
          value ? params.set(name, value) : params.delete(name)
        set(search, next.q)
        filterIds.forEach((id) => set(id, next.filters[id] ?? null))
        set(sort, next.sort === initialSort.sort ? null : next.sort)
        set(dir, next.desc === initialSort.desc ? null : next.desc ? DESC : ASC)
        set(page, next.page > 1 ? String(next.page) : null)
        return params
      },
      { replace: true },
    )
  }

  return { state, update }
}

/** List state local to a component, e.g. a tab on a detail page. */
export function useLocalListState(initialSort: ListSort): ListStateControl {
  const [state, setState] = useState(() => initialListState(initialSort))
  return {
    state,
    update: (patch) => setState((prev) => patchListState(prev, patch)),
  }
}
