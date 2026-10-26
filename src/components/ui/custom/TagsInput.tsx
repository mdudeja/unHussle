import { useEntityList } from '@/workflows/hooks'
import React, { useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from '@/store'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AutocompleteList } from '@/components/ui/custom/AutocompleteList'
import type { AutocompleteOption } from '@/lib/hooks/useAutocomplete'
import { slugifyTag } from '@/lib/inputParsers/parseHashtags'
import { cn } from '@/lib/utils'
import type { TagInput } from '@c/types/index'

const MAX_OPTIONS = 8
const CREATE_ID = '__create__'

export interface TagsInputProps {
  id?: string
  value?: TagInput[] | null
  onChange: (value: TagInput[]) => void
  disabled?: boolean
  placeholder?: string
  hasError?: boolean
}

interface TagOption extends AutocompleteOption {
  title: string
}

/**
 * Chip input for tags. Suggests existing tags from the store as you type and
 * lets you create new ones. Titles are normalized like hashtags (`#` stripped,
 * lowercase, no spaces).
 */
export function TagsInput({
  id,
  value,
  onChange,
  disabled,
  placeholder = 'Add tags...',
  hasError,
}: TagsInputProps) {
  const tags = useStore((state) => state.tags)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  const selected = useMemo(() => value ?? [], [value])
  const normalizedQuery = slugifyTag(query)

  useEntityList('tags')

  const options = useMemo<TagOption[]>(() => {
    const selectedTitles = new Set(selected.map((tag) => tag.title))
    const search = query.trim().replace(/^#/, '').toLowerCase()
    const matches = tags.data
      .filter(
        (tag) =>
          !selectedTitles.has(tag.title) &&
          tag.title.toLowerCase().includes(search),
      )
      .slice(0, MAX_OPTIONS)
      .map((tag) => ({ id: tag.id, label: `#${tag.title}`, title: tag.title }))

    const hasExact = tags.data.some((tag) => tag.title === normalizedQuery)
    if (normalizedQuery && !hasExact && !selectedTitles.has(normalizedQuery)) {
      return [
        {
          id: CREATE_ID,
          label: `Create "#${normalizedQuery}"`,
          title: normalizedQuery,
        },
        ...matches,
      ]
    }
    return matches
  }, [tags.data, selected, query, normalizedQuery])

  // Highlight an exact match so Enter picks the existing tag. A highlight moved
  // with the arrow keys only applies to the options it was set for.
  const exactMatchIndex = options.findIndex(
    (option) => option.id !== CREATE_ID && option.title === normalizedQuery,
  )
  const [highlight, setHighlight] = useState<{
    options: TagOption[]
    index: number
  } | null>(null)
  const highlightedIndex =
    highlight?.options === options ? highlight.index : exactMatchIndex
  const setHighlightedIndex = (next: number | ((index: number) => number)) =>
    setHighlight({
      options,
      index: typeof next === 'function' ? next(highlightedIndex) : next,
    })

  const commit = (rawTitle: string) => {
    const title = slugifyTag(rawTitle)
    setQuery('')
    if (!title || selected.some((tag) => tag.title === title)) return
    const existing = tags.data.find((tag) => tag.title === title)
    onChange([...selected, { title, color: existing?.color ?? undefined }])
  }

  const remove = (title: string) => {
    onChange(selected.filter((tag) => tag.title !== title))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const showList = isOpen && options.length > 0
    switch (event.key) {
      case 'ArrowDown':
        if (!showList) {
          setIsOpen(true)
          return
        }
        event.preventDefault()
        setHighlightedIndex((index) => (index + 1) % options.length)
        return
      case 'ArrowUp':
        if (!showList) return
        event.preventDefault()
        setHighlightedIndex((index) =>
          index <= 0 ? options.length - 1 : index - 1,
        )
        return
      case 'Enter':
        // Keep Enter from submitting the surrounding form while typing a tag.
        if (showList && highlightedIndex >= 0) {
          event.preventDefault()
          commit(options[highlightedIndex].title)
        } else if (query.trim()) {
          event.preventDefault()
          commit(query)
        }
        return
      case ' ':
      case ',':
        event.preventDefault()
        commit(query)
        return
      case 'Backspace':
        if (!query && selected.length > 0) {
          remove(selected[selected.length - 1].title)
        }
        return
      case 'Escape':
        if (isOpen) {
          event.preventDefault()
          event.stopPropagation()
          setIsOpen(false)
        }
        return
    }
  }

  return (
    <div className="relative">
      <div
        aria-invalid={hasError}
        onClick={() => inputRef.current?.focus()}
        className={cn(
          'border-input dark:bg-input/30 flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1 shadow-xs transition-[color,box-shadow]',
          'focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]',
          'aria-invalid:border-destructive',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {selected.map((tag) => (
          <Badge
            key={tag.title}
            variant="primary_outline"
            className="gap-1 pr-1"
          >
            #{tag.title}
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove tag ${tag.title}`}
                onClick={(event) => {
                  event.stopPropagation()
                  remove(tag.title)
                }}
                className="rounded-full hover:bg-primary/20"
              >
                <X className="size-3" />
              </button>
            )}
          </Badge>
        ))}
        <Input
          ref={inputRef}
          id={id}
          value={query}
          disabled={disabled}
          placeholder={selected.length === 0 ? placeholder : undefined}
          autoComplete="off"
          className="h-7 min-w-24 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0 dark:bg-transparent"
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {isOpen && !disabled && (
        <AutocompleteList
          options={options}
          highlightedIndex={highlightedIndex}
          onSelect={(option) => commit(option.title)}
          onHighlight={setHighlightedIndex}
          className="absolute left-0 right-0 top-full z-50 mt-1"
        />
      )}
    </div>
  )
}
