import { useEffect, useRef, useState } from 'react'
import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  OnChangeFn,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Loader2, Search, X } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type DataTableFilterOption = { label: string; value: string }

export type DataTableFilter = {
  columnId: string
  label: string
  options: DataTableFilterOption[]
}

type DataTableProps<TData extends { id: string }> = {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  filters?: DataTableFilter[]
  // The search box is controlled only; the caller decides which rows match
  // (e.g. by fetching search results) and passes them in as `data`.
  searchPlaceholder?: string
  searchValue: string
  onSearchChange: (value: string) => void
  isSearching?: boolean
  columnFilters: ColumnFiltersState
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
  initialSorting?: SortingState
  // Columns used only for filtering, not displayed.
  hiddenColumns?: string[]
  selectedId?: string | null
  onRowClick?: (row: TData) => void
  isLoading?: boolean
  pageSize?: number
  // Rendered between the toolbar and the table, e.g. actions for the selection.
  selectionBar?: React.ReactNode
}

// Sentinel for the "no filter" select item; Radix Select disallows ''.
const ALL_FILTER_VALUE = 'All'

// Filter values come from select options (and the URL), so compare as strings.
const equalsStringFilter: FilterFn<unknown> = (row, columnId, value) =>
  String(row.getValue(columnId) ?? '') === value

export function DataTable<TData extends { id: string }>({
  columns,
  data,
  filters = [],
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  isSearching = false,
  columnFilters,
  onColumnFiltersChange,
  initialSorting = [],
  hiddenColumns = [],
  selectedId,
  onRowClick,
  isLoading = false,
  pageSize = 20,
  selectionBar,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize })
  const selectedRowRef = useRef<HTMLTableRowElement>(null)

  // TanStack Table isn't React Compiler compatible; the compiler isn't used here
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    state: {
      sorting,
      columnFilters,
      pagination,
      columnVisibility: Object.fromEntries(
        hiddenColumns.map((columnId) => [columnId, false]),
      ),
    },
    defaultColumn: { filterFn: equalsStringFilter as FilterFn<TData> },
    onSortingChange: setSorting,
    onColumnFiltersChange,
    onPaginationChange: setPagination,
    // Page index is managed below so it doesn't fight the selected-row jump.
    autoResetPageIndex: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  // Keyed on contents so callers can pass a fresh array every render.
  const columnFiltersKey = JSON.stringify(columnFilters)
  useEffect(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
  }, [searchValue, columnFiltersKey])

  // Jump to the page holding the selected row, then bring it into view.
  const sortedRows = table.getPrePaginationRowModel().rows
  const selectedIndex = selectedId
    ? sortedRows.findIndex((row) => row.id === selectedId)
    : -1
  useEffect(() => {
    if (selectedIndex < 0) {
      return
    }
    setPagination((prev) => ({
      ...prev,
      pageIndex: Math.floor(selectedIndex / prev.pageSize),
    }))
  }, [selectedIndex])

  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selectedId, pagination.pageIndex])

  const getFilterValue = (columnId: string) =>
    (columnFilters.find((f) => f.id === columnId)?.value as string) ??
    ALL_FILTER_VALUE

  const setFilterValue = (columnId: string, value: string) =>
    onColumnFiltersChange((prev) => [
      ...prev.filter((f) => f.id !== columnId),
      ...(value === ALL_FILTER_VALUE ? [] : [{ id: columnId, value }]),
    ])

  const hasActiveFilters = searchValue !== '' || columnFilters.length > 0
  const rows = table.getRowModel().rows

  return (
    <div className="w-full space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8 pr-8"
          />
          {isSearching && (
            <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {filters.map((filter) => (
          <Select
            items={filter.options ?? []}
            key={filter.columnId}
            value={getFilterValue(filter.columnId)}
            onValueChange={(value) =>
              value && setFilterValue(filter.columnId, value)
            }
          >
            <SelectTrigger size="sm">
              <span className="text-muted-foreground">{filter.label}:</span>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER_VALUE}>All</SelectItem>
              {filter.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSearchChange('')
              onColumnFiltersChange([])
            }}
          >
            Reset
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {selectionBar}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => {
                const isSelected = row.id === selectedId
                return (
                  <TableRow
                    key={row.id}
                    ref={isSelected ? selectedRowRef : undefined}
                    data-state={isSelected ? 'selected' : undefined}
                    onClick={() => onRowClick?.(row.original)}
                    // The theme's `muted` matches the page background, so the
                    // default shadcn hover/selected styles are invisible.
                    className={cn(
                      'hover:bg-primary/5 data-[state=selected]:bg-primary/15 data-[state=selected]:shadow-[inset_3px_0_0_var(--primary)]',
                      onRowClick && 'cursor-pointer',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-24 text-center text-muted-foreground"
                >
                  {isLoading ? (
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  ) : (
                    'No results.'
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {table.getFilteredRowModel().rows.length} of {data.length} item(s)
        </span>
        <div className="flex items-center gap-2">
          <span>
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {Math.max(table.getPageCount(), 1)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}
