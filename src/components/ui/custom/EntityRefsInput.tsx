import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useEntrySearch } from '@/workflows/hooks'
import type { EntryRecord } from '@c/workflows/contracts'

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

export interface EntityRefsInputProps {
  id?: string
  /** Kinds to search; with more than one, chips show each item's kind. */
  kinds: RefKind[]
  value?: EntityRef[] | null
  onChange: (value: EntityRef[]) => void
  disabled?: boolean
  placeholder?: string
}

function SearchResults({
  kind,
  term,
  selected,
  onPick,
}: {
  kind: RefKind
  term: string
  selected: EntityRef[]
  onPick: (ref: EntityRef) => void
}) {
  const search = useEntrySearch<EntryRecord>(kind, term)
  const rows = (search.data ?? []).filter(
    (row) => !selected.some((ref) => ref.id === row.id),
  )
  if (search.error)
    return (
      <p role="alert">Could not search {kindLabels[kind].toLowerCase()}s.</p>
    )
  return rows.map((row) => (
    <Button
      key={row.id}
      type="button"
      variant="ghost"
      className="w-full justify-start truncate"
      onClick={() => onPick({ kind, id: row.id, title: String(row.title) })}
    >
      <span className="text-xs text-muted-foreground">{kindLabels[kind]}</span>
      <span className="truncate">{String(row.title)}</span>
    </Button>
  ))
}

/** Chips for linked items, with a search popover to add more. */
export function EntityRefsInput({
  id,
  kinds,
  value,
  onChange,
  disabled,
  placeholder = 'Search…',
}: EntityRefsInputProps) {
  const [open, setOpen] = useState(false)
  const [term, setTerm] = useState('')
  const selected = value ?? []
  const showKind = kinds.length > 1

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={id}
              type="button"
              variant="outline"
              disabled={disabled}
              className="w-full justify-start text-muted-foreground"
            >
              <Plus className="size-4" />
              Add{' '}
              {kinds.map((kind) => kindLabels[kind].toLowerCase()).join(' / ')}
            </Button>
          }
        />
        <PopoverContent className="w-80 space-y-2">
          <Input
            aria-label="Search items to link"
            placeholder={placeholder}
            value={term}
            onChange={(event) => setTerm(event.target.value)}
          />
          {!term && (
            <p className="text-xs text-muted-foreground">Type to search.</p>
          )}
          <div className="max-h-60 overflow-y-auto">
            {kinds.map((kind) => (
              <SearchResults
                key={kind}
                kind={kind}
                term={open ? term : ''}
                selected={selected}
                onPick={(ref) => {
                  onChange([
                    ...selected,
                    showKind ? ref : { ...ref, kind: undefined },
                  ])
                  setTerm('')
                  setOpen(false)
                }}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
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
                  onClick={() =>
                    onChange(selected.filter((other) => other.id !== ref.id))
                  }
                  className="rounded-full hover:bg-primary/20"
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
