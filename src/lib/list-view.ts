import type { ReactNode } from 'react'

export type ListFilterOption = {
  label: string
  value: string
  icon?: ReactNode
}

export type ListFilter<T> = {
  id: string
  label: string
  options: ListFilterOption[]
  /** Whether `row` belongs in the list while `selected` is chosen. */
  matches: (row: T, selected: string) => boolean
}

export type ListSortOption<T> = {
  id: string
  label: string
  // Numbers for enums (their declared order), so they don't sort by label.
  value: (row: T) => string | number | null | undefined
}

export type ListState = {
  q: string
  filters: Record<string, string>
  sort: string
  desc: boolean
  page: number
  pageSize: number
}

export type ListSort = Pick<ListState, 'sort' | 'desc'>

export const LIST_PAGE_SIZE = 20

export const initialListState = (sort: ListSort): ListState => ({
  q: '',
  filters: {},
  page: 1,
  pageSize: LIST_PAGE_SIZE,
  ...sort,
})

// Changing what is listed (search, filters, sort) returns to the first page.
export const patchListState = (
  state: ListState,
  patch: Partial<ListState>,
): ListState => ({ ...state, page: 1, ...patch })

export const filterRows = <T>(
  rows: T[],
  filters: ListFilter<T>[],
  values: Record<string, string>,
) =>
  rows.filter((row) =>
    filters.every(
      (filter) => !values[filter.id] || filter.matches(row, values[filter.id]),
    ),
  )

// For lists searched in memory; entity pages search on the server instead.
export const searchRows = <T extends { title?: string | null }>(
  rows: T[],
  q: string,
) => {
  const term = q.trim().toLowerCase()
  return term
    ? rows.filter((row) => row.title?.toLowerCase().includes(term))
    : rows
}

const isEmpty = (value: unknown) =>
  value === null || value === undefined || value === ''

// Empty values sort last in both directions.
export const sortRows = <T>(
  rows: T[],
  option: ListSortOption<T> | undefined,
  desc: boolean,
) => {
  if (!option) {
    return rows
  }
  return [...rows].sort((a, b) => {
    const left = option.value(a)
    const right = option.value(b)
    if (isEmpty(left) || isEmpty(right)) {
      return Number(isEmpty(left)) - Number(isEmpty(right))
    }
    const order =
      typeof left === 'string' && typeof right === 'string'
        ? left.localeCompare(right, undefined, { sensitivity: 'base' })
        : Number(left) - Number(right)
    return desc ? -order : order
  })
}

export const pageCountOf = (total: number, pageSize = LIST_PAGE_SIZE) =>
  Math.max(1, Math.ceil(total / pageSize))

// Pages are 1-based; an out-of-range page shows the last one.
export const paginate = <T>(
  rows: T[],
  page: number,
  pageSize = LIST_PAGE_SIZE,
) => {
  const pageCount = pageCountOf(rows.length, pageSize)
  const current = Math.min(Math.max(1, page), pageCount)
  return {
    rows: rows.slice((current - 1) * pageSize, current * pageSize),
    page: current,
    pageCount,
  }
}

/** Filters, sorts and pages rows held in memory. */
export const applyListState = <T>(
  rows: T[],
  state: ListState,
  filters: ListFilter<T>[],
  sorts: ListSortOption<T>[],
) => {
  const filtered = filterRows(rows, filters, state.filters)
  const sorted = sortRows(
    filtered,
    sorts.find((option) => option.id === state.sort),
    state.desc,
  )
  return {
    ...paginate(sorted, state.page, state.pageSize),
    total: filtered.length,
  }
}
