import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  Updater,
} from '@tanstack/react-table'
import {
  DataTable,
  DataTableFilter,
} from '@/components/ui/custom/table/DataTable'
import { StoreState, useStore } from '@/store'
import { entitySearchParams } from '@/lib/entityRoutes'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { Logger } from '@c/Logger'
import {
  CreateAreaButtonComponent,
  CreateGoalButtonComponent,
  CreateProjectButtonComponent,
  CreateTagButtonComponent,
  CreateTaskButtonComponent,
  CreateUrlButtonComponent,
} from '../app'

const SEARCH_DEBOUNCE_MS = 300

type EntitySliceState<TData> = {
  data: TData[]
  isLoading: boolean
  fetch: (pageNumber?: number) => Promise<void>
  search: (query: string) => Promise<TData[]>
}

export type EntityListPageConfig<TData extends { id: string }> = {
  title: string
  description?: string
  selectSlice: (state: StoreState) => EntitySliceState<TData>
  columns: ColumnDef<TData, any>[]
  filters?: DataTableFilter[]
  hiddenColumns?: string[]
  initialSorting?: SortingState
}

const titleToCreateButton: Record<string, React.ReactNode> = {
  Projects: <CreateProjectButtonComponent />,
  Areas: <CreateAreaButtonComponent />,
  Goals: <CreateGoalButtonComponent />,
  Tasks: <CreateTaskButtonComponent />,
  URLs: <CreateUrlButtonComponent />,
  Tags: <CreateTagButtonComponent />,
}

// Generic list page for an entity. Search (`q`), column filters (keyed by
// column id) and the selected item (`id`) all live in the URL query string.
// Without a search term the table shows the items already loaded in the
// store; with one, it shows the server's search results instead.
export function EntityListPage<TData extends { id: string }>({
  config,
}: {
  config: EntityListPageConfig<TData>
}) {
  const {
    title,
    description,
    selectSlice,
    columns,
    filters = [],
    hiddenColumns,
    initialSorting = [{ id: 'updated_at', desc: true }],
  } = config

  const slice = useStore(selectSlice)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const { data, isLoading, fetch } = selectSlice(useStore.getState())
    if (data.length > 0 || isLoading) {
      return
    }
    fetch().catch((error) => {
      Logger.getInstance().error(`Failed to fetch ${title}: ${error}`)
    })
  }, [selectSlice, title])

  const selectedId = searchParams.get(entitySearchParams.id)
  const searchValue = searchParams.get(entitySearchParams.search) ?? ''
  const searchTerm = useDebouncedValue(searchValue.trim(), SEARCH_DEBOUNCE_MS)

  // `term` records which search the results belong to.
  const [searchResults, setSearchResults] = useState<{
    term: string
    data: TData[]
  } | null>(null)

  useEffect(() => {
    if (!searchTerm) {
      return
    }
    let isCurrent = true
    selectSlice(useStore.getState())
      .search(searchTerm)
      .then((data) => {
        if (isCurrent) {
          setSearchResults({ term: searchTerm, data })
        }
      })
    return () => {
      isCurrent = false
    }
  }, [searchTerm, selectSlice])

  // While a new search is pending, keep showing the previous results.
  const isSearchActive = searchValue.trim() !== ''
  const isSearching =
    isSearchActive && searchResults?.term !== searchValue.trim()
  const tableData = isSearchActive ? (searchResults?.data ?? []) : slice.data

  const columnFilters: ColumnFiltersState = filters.flatMap((filter) => {
    const value = searchParams.get(filter.columnId)
    return value ? [{ id: filter.columnId, value }] : []
  })

  const setParam = (name: string, value: string | null) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) {
          next.set(name, value)
        } else {
          next.delete(name)
        }
        return next
      },
      { replace: true },
    )

  const handleColumnFiltersChange = (updater: Updater<ColumnFiltersState>) => {
    const nextFilters =
      typeof updater === 'function' ? updater(columnFilters) : updater
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        filters.forEach(({ columnId }) => {
          const value = nextFilters.find((f) => f.id === columnId)?.value
          if (value) {
            next.set(columnId, String(value))
          } else {
            next.delete(columnId)
          }
        })
        return next
      },
      { replace: true },
    )
  }

  // Selecting pushes a history entry so Back returns to the previous item.
  const handleRowClick = (row: TData) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (row.id === selectedId) {
        next.delete(entitySearchParams.id)
      } else {
        next.set(entitySearchParams.id, row.id)
      }
      return next
    })

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {titleToCreateButton[title] ?? null}
      </div>
      <DataTable
        columns={columns}
        data={tableData}
        filters={filters}
        hiddenColumns={hiddenColumns}
        searchPlaceholder={`Search ${title.toLowerCase()}...`}
        searchValue={searchValue}
        onSearchChange={(value) => setParam(entitySearchParams.search, value)}
        isSearching={isSearching}
        columnFilters={columnFilters}
        onColumnFiltersChange={handleColumnFiltersChange}
        initialSorting={initialSorting}
        selectedId={selectedId}
        onRowClick={handleRowClick}
        isLoading={isSearchActive ? isSearching : slice.isLoading}
      />
    </div>
  )
}
