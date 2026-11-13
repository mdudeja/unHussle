import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ListToolbar } from '@/components/ui/custom/list/list-toolbar'
import { ListPagination } from '@/components/ui/custom/list/list-pagination'
import { SelectionBar } from '@/components/ui/custom/list/selection-bar'
import { ActionConfirmDialog } from '@/components/app/action-confirm-dialog'
import { EntityListRow, type EntityRow } from '@/components/app/entity-list-row'
import {
  BulkAction,
  EntityAction,
  EntityKind,
  entityRegistry,
  useCommonActions,
  useCommonBulkActions,
} from '@/lib/entityActions'
import { useRunAction } from '@/lib/entityActions/use-run-action'
import type { ListStateControl } from '@/lib/hooks/use-list-state'
import type { ListFilter, ListSort, ListSortOption } from '@/lib/list-view'
import { cn } from '@/lib/utils'

/** How one kind of entity is listed, on its own page and in detail tabs. */
export type EntityListConfig<T> = {
  kind: EntityKind
  /** Plural, e.g. "Tasks". */
  title: string
  icon: LucideIcon
  renderMeta?: (row: T) => React.ReactNode
  filters: ListFilter<T>[]
  sorts: ListSortOption<T>[]
  initialSort: ListSort
  // Entity-specific actions shown before Edit/Delete.
  // Called as a hook, so it must be the same function on every render.
  useActions?: () => EntityAction<T>[]
  /** The first visible one is shown on each row; the rest go in its menu. */
  primaryActionIds?: string[]
}

type EntityListProps<T extends EntityRow> = {
  config: EntityListConfig<T>
  control: ListStateControl
  /** The rows of the current page. */
  items: T[]
  /** Matching rows across all pages. */
  total: number
  page: number
  pageCount: number
  isLoading: boolean
  isSearching?: boolean
  error?: unknown
  onRetry?: () => void
  /** Shown when nothing exists yet, e.g. a create button. */
  emptyAction?: React.ReactNode
}

const NO_ACTIONS = () => []

export function EntityList<T extends EntityRow>({
  config,
  control: { state, update },
  items,
  total,
  page,
  pageCount,
  isLoading,
  isSearching = false,
  error,
  onRetry,
  emptyAction,
}: EntityListProps<T>) {
  const { kind, title, icon, renderMeta, filters, sorts } = config
  const { label } = entityRegistry[kind]
  const noun = `${label}s`
  const useActions = config.useActions ?? NO_ACTIONS
  const actions = [...useActions(), ...useCommonActions<T>(kind)]

  // Selection belongs to the rows on screen: it resets when they change.
  const viewKey = JSON.stringify(state)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selection, setSelection] = useState({
    viewKey,
    ids: new Set<string>(),
  })
  const selectedIds =
    selection.viewKey === viewKey ? selection.ids : new Set<string>()
  const selectedItems = items.filter((item) => selectedIds.has(item.id))
  const setSelectedIds = (ids: Set<string>) => setSelection({ viewKey, ids })
  const stopSelecting = () => {
    setIsSelecting(false)
    setSelectedIds(new Set())
  }
  const toggle = (id: string) => {
    const next = new Set(selectedIds)
    if (!next.delete(id)) {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const bulkActions: BulkAction<T>[] = useCommonBulkActions<T>(kind).map(
    (action) => ({
      ...action,
      run: async (selected) => {
        await action.run(selected)
        stopSelecting()
      },
    }),
  )
  const bulkRunner = useRunAction(selectedItems)

  const hasCriteria =
    state.q.trim() !== '' || Object.keys(state.filters).length > 0
  const summary = `Showing ${items.length} of ${total} ${total === 1 ? label : noun}`

  const renderBody = () => {
    if (items.length > 0) {
      return (
        <ul className="flex flex-col gap-3" aria-busy={isLoading}>
          {items.map((item) => (
            <EntityListRow
              key={item.id}
              kind={kind}
              item={item}
              fallbackIcon={icon}
              meta={renderMeta?.(item)}
              actions={actions}
              primaryActionIds={config.primaryActionIds}
              selection={
                isSelecting
                  ? {
                      isSelected: selectedIds.has(item.id),
                      onToggle: () => toggle(item.id),
                    }
                  : undefined
              }
            />
          ))}
        </ul>
      )
    }
    if (isLoading) {
      return (
        <p className="flex justify-center py-10" aria-label={`Loading ${noun}`}>
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </p>
      )
    }
    if (error) {
      return (
        <section className="flex flex-col items-center gap-3 py-10 text-center">
          <p role="alert" className="text-sm text-destructive">
            Could not load {noun}. Check your connection, then try again.
          </p>
          {onRetry && (
            <Button type="button" variant="outline" onClick={onRetry}>
              Try again
            </Button>
          )}
        </section>
      )
    }
    return (
      <section className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          {hasCriteria
            ? `No ${noun} match your search or filters.`
            : `No ${noun} yet.`}
        </p>
        {hasCriteria ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => update({ q: '', filters: {} })}
          >
            Clear search and filters
          </Button>
        ) : (
          emptyAction
        )}
      </section>
    )
  }

  return (
    <section
      aria-label={title}
      // Room for the selection bar fixed to the bottom of small screens.
      className={cn('flex flex-col gap-4', isSelecting && 'pb-28 md:pb-0')}
    >
      {isSelecting ? (
        <SelectionBar
          selectedCount={selectedItems.length}
          pageItemCount={items.length}
          onToggleAll={() =>
            setSelectedIds(
              selectedItems.length === items.length
                ? new Set()
                : new Set(items.map((item) => item.id)),
            )
          }
          onCancel={stopSelecting}
          error={bulkRunner.error}
        >
          {bulkActions.map((action) => (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.variant ?? 'default'}
              disabled={
                bulkRunner.pendingId !== null ||
                action.isDisabled?.(selectedItems)
              }
              title={
                selectedItems.length === 0
                  ? 'Select at least one item first'
                  : undefined
              }
              onClick={() => bulkRunner.trigger(action)}
            >
              {bulkRunner.pendingId === action.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <action.icon className="size-4" />
              )}
              {action.label}
            </Button>
          ))}
          <ActionConfirmDialog runner={bulkRunner} />
        </SelectionBar>
      ) : (
        <ListToolbar
          noun={noun}
          state={state}
          onChange={update}
          filters={filters}
          sorts={sorts}
          isSearching={isSearching}
          onSelect={items.length > 0 ? () => setIsSelecting(true) : undefined}
        />
      )}
      {renderBody()}
      <ListPagination
        summary={summary}
        total={total}
        page={page}
        pageCount={pageCount}
        onPageChange={(page) => update({ page })}
        onPageSizeChange={(pageSize) => update({ pageSize })}
        isLoading={isLoading}
      />
    </section>
  )
}
