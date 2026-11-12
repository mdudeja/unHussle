import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'

type SelectionBarProps = {
  selectedCount: number
  pageItemCount: number
  onToggleAll: () => void
  onCancel: () => void
  /** Bulk action buttons. */
  children?: React.ReactNode
  error?: string | null
}

/**
 * Replaces the list toolbar while selecting. Fixed to the bottom of small
 * screens, within thumb reach; in place above the list from `md` up.
 */
export function SelectionBar({
  selectedCount,
  pageItemCount,
  onToggleAll,
  onCancel,
  children,
  error,
}: SelectionBarProps) {
  const isAllSelected = pageItemCount > 0 && selectedCount === pageItemCount
  return (
    <section
      aria-label="Selection"
      className="fixed inset-x-4 bottom-4 z-20 flex flex-col gap-2 rounded-md border bg-popover px-3 py-2 shadow-lg md:static md:shadow-none"
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={isAllSelected}
            indeterminate={selectedCount > 0 && !isAllSelected}
            onCheckedChange={onToggleAll}
          />
          Select all on this page
        </label>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {selectedCount > 0
            ? `${selectedCount} selected`
            : 'Tick items to act on them'}
        </span>
        <div className="flex flex-wrap items-center gap-2 md:ml-auto">
          {children}
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
