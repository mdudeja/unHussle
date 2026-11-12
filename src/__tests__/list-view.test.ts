import { describe, expect, test } from 'bun:test'
import {
  applyListState,
  filterRows,
  initialListState,
  paginate,
  patchListState,
  searchRows,
  sortRows,
  type ListFilter,
  type ListSortOption,
} from '@/lib/list-view'
import { parseTaskFlagFilter } from '@/lib/task-flags'

type Row = {
  id: string
  title: string
  status?: string
  rank?: number
  done?: boolean
}

const rows: Row[] = [
  { id: 'a', title: 'beta', status: 'planned', rank: 2, done: false },
  { id: 'b', title: 'Alpha', status: 'completed', done: true },
  { id: 'c', title: 'gamma', status: 'planned', rank: 1, done: false },
]

const ids = (list: Row[]) => list.map((row) => row.id)

const statusFilter: ListFilter<Row> = {
  id: 'status',
  label: 'Status',
  options: [],
  matches: (row, selected) => row.status === selected,
}
const doneFilter: ListFilter<Row> = {
  id: 'done',
  label: 'Done',
  options: [],
  matches: (row, selected) => String(row.done) === selected,
}
const titleSort: ListSortOption<Row> = {
  id: 'title',
  label: 'Title',
  value: (row) => row.title,
}
const rankSort: ListSortOption<Row> = {
  id: 'rank',
  label: 'Rank',
  value: (row) => row.rank,
}

describe('filterRows', () => {
  test('keeps rows matching every set filter', () => {
    expect(
      ids(filterRows(rows, [statusFilter, doneFilter], { status: 'planned' })),
    ).toEqual(['a', 'c'])
  })

  test("uses each filter's own match", () => {
    expect(ids(filterRows(rows, [doneFilter], { done: 'true' }))).toEqual(['b'])
  })
})

describe('sortRows', () => {
  test('sorts text ignoring case', () => {
    expect(ids(sortRows(rows, titleSort, false))).toEqual(['b', 'a', 'c'])
  })

  test('puts empty values last in both directions', () => {
    expect(ids(sortRows(rows, rankSort, false))).toEqual(['c', 'a', 'b'])
    expect(ids(sortRows(rows, rankSort, true))).toEqual(['a', 'c', 'b'])
  })

  test('leaves rows as they are without a sort option', () => {
    expect(ids(sortRows(rows, undefined, true))).toEqual(['a', 'b', 'c'])
  })
})

describe('paginate', () => {
  test('returns the requested page', () => {
    expect(paginate([1, 2, 3, 4, 5], 2, 2)).toEqual({
      rows: [3, 4],
      page: 2,
      pageCount: 3,
    })
  })

  test('shows the last page when the page is out of range', () => {
    expect(paginate([1, 2, 3], 9, 2)).toEqual({
      rows: [3],
      page: 2,
      pageCount: 2,
    })
  })

  test('has one page when empty', () => {
    expect(paginate([], 1, 2)).toEqual({ rows: [], page: 1, pageCount: 1 })
  })
})

describe('parseTaskFlagFilter', () => {
  test('reads set and unset flags', () => {
    expect(parseTaskFlagFilter('quick')).toEqual({
      id: 'is_quick',
      isSet: true,
    })
    expect(parseTaskFlagFilter('not-chore')).toEqual({
      id: 'is_chore',
      isSet: false,
    })
  })

  test('ignores unknown values', () => {
    expect(parseTaskFlagFilter('not-boring')).toBeUndefined()
  })
})

describe('list state', () => {
  test('changing what is listed returns to the first page', () => {
    const state = {
      ...initialListState({ sort: 'title', desc: false }),
      page: 3,
    }
    expect(patchListState(state, { q: 'x' }).page).toBe(1)
    expect(patchListState(state, { page: 2 }).page).toBe(2)
  })

  test('searchRows matches titles ignoring case', () => {
    expect(ids(searchRows(rows, ' ALP '))).toEqual(['b'])
  })

  test('applyListState filters, sorts and counts matches', () => {
    const state = {
      ...initialListState({ sort: 'title', desc: true }),
      filters: { status: 'planned' },
    }
    const view = applyListState(rows, state, [statusFilter], [titleSort])
    expect(ids(view.rows)).toEqual(['c', 'a'])
    expect(view.total).toBe(2)
  })
})
