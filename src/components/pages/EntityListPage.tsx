import { useEntryList, useEntrySearch } from '@/workflows/hooks'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { useUrlListState } from '@/lib/hooks/use-list-state'
import { applyListState } from '@/lib/list-view'
import { CreateEntityButton } from '@/components/app'
import { EntityList, type EntityListConfig } from '@/components/app/entity-list'
import type { EntityRow } from '@/components/app/entity-list-row'

const SEARCH_DEBOUNCE_MS = 300

export type EntityListPageConfig<T> = EntityListConfig<T> & {
  description?: string
}

// Generic list page for an entity. Its search, filters, sort and page live
// in the URL. Searches run on the server; the rest is applied in memory.
export function EntityListPage<T extends EntityRow>({
  config,
}: {
  config: EntityListPageConfig<T>
}) {
  const { kind, title, description, filters, sorts, initialSort } = config
  const control = useUrlListState(
    filters.map((filter) => filter.id),
    initialSort,
  )
  const { state } = control

  const searchValue = state.q.trim()
  const searchTerm = useDebouncedValue(searchValue, SEARCH_DEBOUNCE_MS)
  const listQuery = useEntryList(kind)
  const searchQuery = useEntrySearch<T>(kind, searchTerm)
  const isSearchActive = searchValue !== ''
  const isSearching =
    isSearchActive && (searchTerm !== searchValue || searchQuery.isLoading)
  const query = isSearchActive ? searchQuery : listQuery
  const rows = (query.data ?? []) as unknown as T[]
  const view = applyListState(rows, state, filters, sorts)

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <CreateEntityButton kind={kind} />
      </header>
      <EntityList
        config={config}
        control={control}
        items={view.rows}
        total={view.total}
        page={view.page}
        pageCount={view.pageCount}
        isLoading={isSearchActive ? isSearching : listQuery.isLoading}
        isSearching={isSearching}
        error={query.error}
        onRetry={query.retry}
        emptyAction={<CreateEntityButton kind={kind} />}
      />
    </div>
  )
}
