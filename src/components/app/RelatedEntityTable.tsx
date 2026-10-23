import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ColumnDef, ColumnFiltersState } from '@tanstack/react-table'
import {
  DataTable,
  DataTableFilter,
} from '@/components/ui/custom/table/DataTable'
import { EntityRouteKey, getEntityItemRoute } from '@/lib/entityRoutes'

type RelatedEntityTableProps<
  TData extends { id: string; title?: string | null },
> = {
  title: string
  kind: EntityRouteKey
  data: TData[]
  columns: ColumnDef<TData, any>[]
  filters?: DataTableFilter[]
  hiddenColumns?: string[]
  isLoading?: boolean
}

/**
 * A secondary table of items linked to the selected one. Search and filters
 * are local (not in the URL); clicking a row opens it on its own list page.
 */
export function RelatedEntityTable<
  TData extends { id: string; title?: string | null },
>({
  title,
  kind,
  data,
  columns,
  filters,
  hiddenColumns,
  isLoading,
}: RelatedEntityTableProps<TData>) {
  const navigate = useNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

  const term = searchValue.trim().toLowerCase()
  const rows = term
    ? data.filter((row) => row.title?.toLowerCase().includes(term))
    : data

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <DataTable
        columns={columns}
        data={rows}
        filters={filters}
        hiddenColumns={hiddenColumns}
        searchPlaceholder={`Search ${title.toLowerCase()}...`}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        initialSorting={[{ id: 'updated_at', desc: true }]}
        onRowClick={(row) => navigate(getEntityItemRoute(kind, row.id))}
        isLoading={isLoading}
        pageSize={10}
      />
    </section>
  )
}
