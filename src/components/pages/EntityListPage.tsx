import { useEntryList, useEntrySearch, useEntryDetail } from '@/workflows/hooks'
import { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { LucideIcon } from 'lucide-react'
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
import { entitySearchParams } from '@/lib/entityRoutes'
import {
  EntityAction,
  EntityKind,
  getEntityTitle,
  useCommonActions,
} from '@/lib/entityActions'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { CreateEntityButton, EntityActionBar } from '../app'

const SEARCH_DEBOUNCE_MS = 300

export type EntityListPageConfig<TData extends { id: string }> = {
  kind: EntityKind
  title: string
  description?: string
  columns: ColumnDef<TData, unknown>[]
  filters?: DataTableFilter[]
  hiddenColumns?: string[]
  initialSorting?: SortingState
  // Entity-specific actions shown before Edit/Delete for the selected item.
  // Called as a hook, so it must be the same function on every render.
  useActions?: () => EntityAction<TData>[]
  // Items linked to the selected one, toggled from the action bar and shown
  // below the table.
  related?: {
    label: string
    icon: LucideIcon
    render: (item: TData) => ReactNode
  }
}

// Generic list page for an entity. Search (`q`), column filters (keyed by
// column id), the selected item (`id`) and whether its related items are
// shown (`related`) all live in the URL query string.
// Lists and searches consume independent query results.
export function EntityListPage<TData extends { id: string }>({
  config,
}: {
  config: EntityListPageConfig<TData>
}) {
  const {
    kind,
    title,
    description,
    columns,
    filters = [],
    hiddenColumns,
    initialSorting = [{ id: 'updated_at', desc: true }],
    useActions,
    related,
  } = config

  const [searchParams, setSearchParams] = useSearchParams()

  const listQuery = useEntryList(kind)

  const selectedId = searchParams.get(entitySearchParams.id)
  const isRelatedShown = searchParams.has(entitySearchParams.related)
  const searchValue = searchParams.get(entitySearchParams.search) ?? ''
  const searchTerm = useDebouncedValue(searchValue.trim(), SEARCH_DEBOUNCE_MS)

  const searchQuery = useEntrySearch<TData>(kind, searchTerm)
  const isSearchActive = searchValue.trim() !== ''
  const isSearching =
    isSearchActive &&
    (searchTerm !== searchValue.trim() || searchQuery.isLoading)
  const tableData = isSearchActive
    ? (searchQuery.data ?? [])
    : ((listQuery.data ?? []) as unknown as TData[])
  const selectedDetail = useEntryDetail(
    kind,
    selectedId ?? '',
    Boolean(selectedId) && !tableData.some((row) => row.id === selectedId),
  )
  const selectedItem = selectedId
    ? (tableData.find((row) => row.id === selectedId) ??
      (selectedDetail.data as TData | null))
    : null

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
          // Filter options are all strings (see DataTableFilterOption)
          if (typeof value === 'string' && value) {
            next.set(columnId, value)
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
  // A new selection starts with its related items hidden.
  const selectItem = (id: string | null, options?: { replace?: boolean }) =>
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete(entitySearchParams.related)
      if (id) {
        next.set(entitySearchParams.id, id)
      } else {
        next.delete(entitySearchParams.id)
      }
      return next
    }, options)

  const handleRowClick = (row: TData) =>
    selectItem(row.id === selectedId ? null : row.id)

  const relatedAction: EntityAction<TData>[] = related
    ? [
        {
          id: 'related',
          label: `${isRelatedShown ? 'Hide' : 'Show'} ${related.label}`,
          icon: related.icon,
          variant: isRelatedShown ? 'default' : 'outline',
          run: () =>
            setParam(entitySearchParams.related, isRelatedShown ? null : '1'),
        },
      ]
    : []
  const actions = [
    ...(useActions?.() ?? []),
    ...relatedAction,
    ...useCommonActions<TData>(kind, {
      onDeleted: (item) => {
        if (item.id === selectedId) {
          selectItem(null, { replace: true })
        }
      },
    }),
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <CreateEntityButton kind={kind} />
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
        isLoading={isSearchActive ? isSearching : listQuery.isLoading}
        selectionBar={
          selectedItem && (
            <EntityActionBar
              key={selectedItem.id}
              item={selectedItem}
              actions={actions}
              title={getEntityTitle(selectedItem)}
              onClose={() => selectItem(null)}
            />
          )
        }
      />
      {related &&
        selectedItem &&
        isRelatedShown &&
        related.render(selectedItem)}
    </div>
  )
}
