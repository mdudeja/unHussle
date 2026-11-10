import { fetchReferences } from '@/services/readModels'
import React, { useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AutocompleteList } from '@/components/ui/custom/AutocompleteList'
import type { AutocompleteOption } from '@/lib/hooks/useAutocomplete'
import { useDebouncedValue } from '@/lib/hooks/useDebouncedValue'
import { cn } from '@/lib/utils'
import { useWorkflowQuery } from '@/workflows/hooks'
import { dependencies } from '@/bootstrap'

export type RefKind = 'resources' | 'tasks' | 'projects' | 'areas' | 'goals'

/** A linked item; `kind` is kept when the input offers several kinds. */
export type EntityRef = { id: string; title: string; kind?: RefKind }

const kindLabels: Record<RefKind, string> = {
  resources: 'Resource',
  tasks: 'Task',
  projects: 'Project',
  areas: 'Area',
  goals: 'Goal',
}

const SEARCH_DEBOUNCE_MS = 200
const MAX_OPTIONS = 8

export interface EntityRefsInputProps {
  id?: string
  /** Kinds to search; with more than one, chips show each item's kind. */
  kinds: RefKind[]
  value?: EntityRef[] | null
  onChange: (value: EntityRef[]) => void
  disabled?: boolean
  placeholder?: string
  hasError?: boolean
}

interface RefOption extends AutocompleteOption {
  ref: EntityRef
}

/** Server search across `kinds`, one query for all of them. */
function useRefSearch(kinds: RefKind[], term: string) {
  const key = kinds.join(',')
  return useWorkflowQuery(
    {
      key: `search:refs:${key}:${term}`,
      dependencies: [...new Set(kinds.flatMap((kind) => dependencies(kind)))],
      load: async () =>
        (
          await Promise.all(
            kinds.map(async (kind) =>
              (
                await fetchReferences(kind, { q: term, limit: MAX_OPTIONS })
              ).items.map((row): EntityRef => ({
                kind,
                id: row.id,
                title: String(row.title),
              })),
            ),
          )
        ).flat(),
    },
    Boolean(term),
  )
}

/**
 * Chip input for linked items: type to search, pick with the arrow keys and
 * Enter (or a click), Backspace removes the last chip.
 */
export function EntityRefsInput({
  id,
  kinds,
  value,
  onChange,
  disabled,
  placeholder = 'Search…',
  hasError,
}: EntityRefsInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const selected = useMemo(() => value ?? [], [value])
  const showKind = kinds.length > 1

  const term = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS)
  const search = useRefSearch(kinds, term)

  const options = useMemo<RefOption[]>(() => {
    const taken = new Set(selected.map((ref) => ref.id))
    return (search.data ?? [])
      .filter((ref) => !taken.has(ref.id))
      .slice(0, MAX_OPTIONS)
      .map((ref) => ({
        id: `${ref.kind}:${ref.id}`,
        label: ref.title,
        hint: showKind && ref.kind ? kindLabels[ref.kind] : undefined,
        ref,
      }))
  }, [search.data, selected, showKind])

  // A highlight moved with the arrow keys only applies to the options it was
  // set for; otherwise the first option is highlighted.
  const [highlight, setHighlight] = useState<{
    options: RefOption[]
    index: number
  } | null>(null)
  const highlightedIndex =
    highlight?.options === options ? highlight.index : options.length ? 0 : -1
  const setHighlightedIndex = (next: number | ((index: number) => number)) =>
    setHighlight({
      options,
      index: typeof next === 'function' ? next(highlightedIndex) : next,
    })

  const commit = (ref: EntityRef) => {
    setQuery('')
    if (selected.some((other) => other.id === ref.id)) return
    onChange([...selected, showKind ? ref : { ...ref, kind: undefined }])
  }

  const remove = (refId: string) =>
    onChange(selected.filter((ref) => ref.id !== refId))

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
        // Keep Enter from submitting the surrounding form while searching.
        if (query.trim()) event.preventDefault()
        if (showList && highlightedIndex >= 0)
          commit(options[highlightedIndex].ref)
        return
      case 'Backspace':
        if (!query && selected.length > 0)
          remove(selected[selected.length - 1].id)
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

  const searching =
    Boolean(query.trim()) && (term !== query.trim() || search.isLoading)
  const emptyMessage = !query.trim()
    ? undefined
    : searching
      ? 'Searching…'
      : search.error
        ? 'Could not search.'
        : 'No matches.'

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
        {selected.map((ref) => (
          <Badge
            key={`${ref.kind ?? ''}:${ref.id}`}
            variant="outline"
            className="max-w-full gap-1 pr-1"
          >
            {showKind && ref.kind && (
              <span className="text-muted-foreground">
                {kindLabels[ref.kind]}:
              </span>
            )}
            <span className="truncate">{ref.title}</span>
            {!disabled && (
              <button
                type="button"
                aria-label={`Remove ${ref.title}`}
                onClick={(event) => {
                  event.stopPropagation()
                  remove(ref.id)
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
          onSelect={(option) => commit(option.ref)}
          onHighlight={setHighlightedIndex}
          emptyMessage={emptyMessage}
          className="absolute left-0 right-0 top-full z-50 mt-1"
        />
      )}
    </div>
  )
}
