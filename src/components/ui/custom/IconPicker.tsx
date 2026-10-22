import { useMemo, useState } from 'react'
import { iconNames, type IconName } from 'lucide-react/dynamic'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { IconResolver } from '@/components/ui/utils/IconResolver'
import { cn } from '@/lib/utils'

/** Shown when the search box is empty. */
export const COMMON_ICONS: IconName[] = [
  'folder',
  'folder-kanban',
  'briefcase',
  'target',
  'flag',
  'star',
  'rocket',
  'lightbulb',
  'book-open',
  'graduation-cap',
  'code',
  'brain',
  'heart',
  'dumbbell',
  'house',
  'users',
  'wallet',
  'shopping-cart',
  'plane',
  'globe',
  'music',
  'camera',
  'palette',
  'coffee',
  'leaf',
  'calendar',
  'layers',
  'boxes',
  'list-todo',
  'sparkles',
]

/** Each icon is a lazily loaded chunk, so only render a bounded number. */
const MAX_RESULTS = 120

export interface IconPickerProps {
  id?: string
  value?: string | null
  onChange: (value: string | undefined) => void
  disabled?: boolean
  placeholder?: string
  hasError?: boolean
}

/**
 * Popover based picker for lucide icons. Emits the kebab-case icon name
 * understood by `IconResolver`, or `undefined` when cleared.
 */
export function IconPicker({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  hasError,
}: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected =
    value && (iconNames as string[]).includes(value)
      ? (value as IconName)
      : undefined

  const { results, total } = useMemo(() => {
    const term = query.trim().toLowerCase().replace(/\s+/g, '-')
    if (!term) return { results: COMMON_ICONS, total: COMMON_ICONS.length }
    const matches = iconNames.filter((name) => name.includes(term))
    return { results: matches.slice(0, MAX_RESULTS), total: matches.length }
  }, [query])

  const handleOpenChange = (open: boolean) => {
    if (!open) setQuery('')
    setIsOpen(open)
  }

  const select = (next: IconName | undefined) => {
    onChange(next)
    handleOpenChange(false)
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={hasError}
          className={cn(
            'w-full justify-start gap-2 font-normal',
            !selected && 'text-muted-foreground',
          )}
        >
          {selected && <IconResolver icon={selected} size={16} />}
          {selected ?? placeholder ?? 'Pick an icon'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3 p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            placeholder={`Search ${iconNames.length} icons...`}
            aria-label="Search icons"
            className="pl-8"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="grid max-h-64 grid-cols-8 gap-1 overflow-y-auto">
          {results.map((name) => (
            <Button
              key={name}
              type="button"
              variant={name === selected ? 'secondary' : 'ghost'}
              size="icon"
              title={name}
              aria-label={name}
              className="size-8"
              onClick={() => select(name)}
            >
              <IconResolver icon={name} size={16} />
            </Button>
          ))}
        </div>
        {results.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            No icons found
          </p>
        )}
        {total > results.length && (
          <p className="text-center text-xs text-muted-foreground">
            Showing {results.length} of {total}. Refine your search.
          </p>
        )}
        {!query.trim() && (
          <p className="text-center text-xs text-muted-foreground">
            Type to search all icons
          </p>
        )}
        {selected && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => select(undefined)}
          >
            Clear icon
          </Button>
        )}
      </PopoverContent>
    </Popover>
  )
}
