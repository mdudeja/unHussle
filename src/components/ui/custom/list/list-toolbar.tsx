import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  ListChecks,
  Loader2,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import type { ListFilter, ListSortOption, ListState } from '@/lib/list-view'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

type FilterControl = Omit<ListFilter<never>, 'value'>
type SortControl = Omit<ListSortOption<never>, 'value'>

type ListToolbarProps = {
  /** Plural, lowercase name of what is listed, e.g. "tasks". */
  noun: string
  state: ListState
  onChange: (patch: Partial<ListState>) => void
  filters: FilterControl[]
  sorts: SortControl[]
  isSearching?: boolean
  /** Shows the Select button. */
  onSelect?: () => void
}

// Sentinel for the "no filter" option; Select disallows ''.
const ALL = 'all'

function FilterSelect({
  filter,
  value,
  onChange,
  className,
}: {
  filter: FilterControl
  value: string | undefined
  onChange: (value: string | undefined) => void
  className?: string
}) {
  return (
    <Select
      items={[{ label: 'All', value: ALL }, ...filter.options]}
      value={value ?? ALL}
      onValueChange={(next) =>
        next && onChange(next === ALL ? undefined : next)
      }
    >
      <SelectTrigger
        size="sm"
        className={className}
        aria-label={`Filter by ${filter.label.toLowerCase()}`}
      >
        <span className="text-muted-foreground">{filter.label}:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectItem value={ALL}>All</SelectItem>
        {filter.options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.icon}
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ListToolbar({
  noun,
  state,
  onChange,
  filters,
  sorts,
  isSearching = false,
  onSelect,
}: ListToolbarProps) {
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)
  const activeFilters = filters.flatMap((filter) => {
    const option = filter.options.find(
      (option) => option.value === state.filters[filter.id],
    )
    return option ? [{ filter, option }] : []
  })
  const setFilter = (id: string, value: string | undefined) => {
    const next = { ...state.filters }
    if (value) {
      next[id] = value
    } else {
      delete next[id]
    }
    onChange({ filters: next })
  }
  const DirectionIcon = state.desc ? ArrowDown : ArrowUp
  const directionLabel = state.desc ? 'Descending' : 'Ascending'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={state.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder={`Search ${noun}...`}
            aria-label={`Search ${noun}`}
            className="pr-8 pl-8"
          />
          {isSearching && (
            <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        {filters.length > 0 && (
          <>
            <div className="hidden flex-wrap items-center gap-2 md:flex">
              {filters.map((filter) => (
                <FilterSelect
                  key={filter.id}
                  filter={filter}
                  value={state.filters[filter.id]}
                  onChange={(value) => setFilter(filter.id, value)}
                />
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={() => setIsFilterSheetOpen(true)}
            >
              <SlidersHorizontal className="size-4" />
              Filters
              {activeFilters.length > 0 && ` (${activeFilters.length})`}
            </Button>
          </>
        )}
        {sorts.length > 0 && (
          <div className="flex items-center gap-1">
            <Select
              items={sorts.map((sort) => ({
                label: sort.label,
                value: sort.id,
              }))}
              value={state.sort}
              onValueChange={(sort) => sort && onChange({ sort })}
            >
              <SelectTrigger size="sm" aria-label="Sort by">
                <span className="text-muted-foreground">Sort:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false}>
                {sorts.map((sort) => (
                  <SelectItem key={sort.id} value={sort.id}>
                    {sort.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              title={directionLabel}
              aria-label={`${directionLabel}, change sort direction`}
              onClick={() => onChange({ desc: !state.desc })}
            >
              <DirectionIcon className="size-4" />
            </Button>
          </div>
        )}
        {onSelect && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={onSelect}
          >
            <ListChecks className="size-4" />
            Select
          </Button>
        )}
      </div>

      {activeFilters.length > 0 && (
        <ul
          className="flex flex-wrap items-center gap-2"
          aria-label="Active filters"
        >
          {activeFilters.map(({ filter, option }) => (
            <li key={filter.id}>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                aria-label={`Remove filter ${filter.label}: ${option.label}`}
                onClick={() => setFilter(filter.id, undefined)}
              >
                {filter.label}: {option.label}
                <X className="size-3" />
              </Button>
            </li>
          ))}
          <li>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onChange({ filters: {} })}
            >
              Clear filters
            </Button>
          </li>
        </ul>
      )}

      <Sheet open={isFilterSheetOpen} onOpenChange={setIsFilterSheetOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-6">
            {filters.map((filter) => (
              <div key={filter.id} className="flex flex-col gap-1.5">
                <Label>{filter.label}</Label>
                <FilterSelect
                  filter={filter}
                  value={state.filters[filter.id]}
                  onChange={(value) => setFilter(filter.id, value)}
                  className="w-full"
                />
              </div>
            ))}
            <Button type="button" onClick={() => setIsFilterSheetOpen(false)}>
              Show results
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
