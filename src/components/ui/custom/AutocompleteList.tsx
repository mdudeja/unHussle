import { cn } from '@/lib/utils'
import type { AutocompleteOption } from '@/lib/hooks/useAutocomplete'

interface AutocompleteListProps<T extends AutocompleteOption> {
  options: T[]
  highlightedIndex: number
  onSelect: (option: T) => void
  onHighlight?: (index: number) => void
  emptyMessage?: string
  className?: string
}

/**
 * Presentational dropdown for autocomplete suggestions. Positioning is left to
 * the consumer (e.g. `className="absolute z-50 mt-1 w-full"` inside a
 * `relative` container).
 */
export function AutocompleteList<T extends AutocompleteOption>({
  options,
  highlightedIndex,
  onSelect,
  onHighlight,
  emptyMessage,
  className,
}: AutocompleteListProps<T>) {
  if (options.length === 0) {
    if (!emptyMessage) return null
    return (
      <div
        className={cn(
          'rounded-md border bg-popover p-2 text-sm text-muted-foreground shadow-md',
          className,
        )}
      >
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      role="listbox"
      className={cn(
        'max-h-60 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md',
        className,
      )}
    >
      {options.map((option, index) => (
        <button
          key={option.id}
          type="button"
          role="option"
          aria-selected={index === highlightedIndex}
          // Prevent the input from losing focus before the click is handled.
          onMouseDown={(event) => {
            event.preventDefault()
            onSelect(option)
          }}
          onMouseEnter={() => onHighlight?.(index)}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm transition-colors',
            index === highlightedIndex
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-accent/60',
          )}
        >
          <span className="truncate">{option.label}</span>
          <span className="gap-2 flex items-center">
            {option.additionalInfo && (
              <span className="border-primary bg-primary/10 text-primary rounded-md px-1.5 py-0.5">
                {option.additionalInfo}
              </span>
            )}
            {option.hint && (
              <span className="shrink-0 text-xs capitalize text-muted-foreground">
                {option.hint}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  )
}
