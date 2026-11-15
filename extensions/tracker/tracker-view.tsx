import { useState } from 'react'
import {
  Badge,
  Button,
  Input,
  Loader2,
  Plus,
  ProgressStatus,
  Search,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  X,
} from 'unhussle/frontend'
import { useTracker } from './api-context'
import type { ItemType } from './item-types'
import { KIND_LABELS, itemKey, type ItemKind, type TrackedItem } from './items'
import { ItemCard } from './item-card'
import { AddItemDialog } from './add-item-dialog'
import { FinishDialog } from './finish-dialog'
import { TypesDialog } from './types-dialog'
import { useItemChanges } from './use-item-changes'
import { useItemTypes } from './use-item-types'
import { useItems } from './use-items'

const ALL = 'all'
const OTHER_TYPE = 'Other'

export function TrackerView() {
  const types = useItemTypes()
  if (types.state.status === 'loading')
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </p>
    )
  if (types.state.status === 'error')
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-destructive">{types.state.message}</p>
        <Button type="button" variant="outline" onClick={types.retry}>
          Try again
        </Button>
      </div>
    )
  return <TrackerBoard types={types.state.types} saveTypes={types.save} />
}

type Dialog =
  | { kind: 'add' }
  | { kind: 'types' }
  | { kind: 'finish'; item: TrackedItem }

function TrackerBoard({
  types,
  saveTypes,
}: {
  types: ItemType[]
  saveTypes: (types: ItemType[]) => Promise<void>
}) {
  const { kanban } = useTracker()
  const { items, taskCounts, isLoading, error, retry, isTruncated } =
    useItems()
  const changes = useItemChanges()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [kindFilter, setKindFilter] = useState<ItemKind | typeof ALL>(ALL)
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const typeName = (id: string) =>
    types.find((type) => type.id === id)?.name ?? OTHER_TYPE
  const term = search.trim().toLowerCase()
  const shown = items.filter(
    (item) =>
      (typeFilter === ALL || item.tracker.type === typeFilter) &&
      (kindFilter === ALL || item.kind === kindFilter) &&
      (!term || item.title.toLowerCase().includes(term)),
  )
  const stages = kanban.DEFAULT_STAGES
  const columnFor = (item: TrackedItem) => kanban.columnFor(item, stages)
  const hidden = shown.filter((item) => columnFor(item) < 0).length

  const typeItems = [
    { value: ALL, label: 'All types' },
    ...types.map(({ id, name }) => ({ value: id, label: name })),
  ]
  const kindItems = [
    { value: ALL, label: 'Projects and goals' },
    ...(Object.keys(KIND_LABELS) as ItemKind[]).map((kind) => ({
      value: kind,
      label: `${KIND_LABELS[kind]}s`,
    })),
  ]
  const chips = [
    ...(typeFilter === ALL
      ? []
      : [{ label: typeName(typeFilter), clear: () => setTypeFilter(ALL) }]),
    ...(kindFilter === ALL
      ? []
      : [{ label: `${KIND_LABELS[kindFilter]}s`, clear: () => setKindFilter(ALL) }]),
    ...(term ? [{ label: `"${search.trim()}"`, clear: () => setSearch('') }] : []),
  ]

  // Moving to Completed asks for a rating first, like Finish.
  const move = (item: TrackedItem, status: ProgressStatus) =>
    status === ProgressStatus.COMPLETED
      ? setDialog({ kind: 'finish', item })
      : void changes.move(item, status)

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-medium">Progress</h1>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setDialog({ kind: 'types' })}
          >
            Edit types
          </Button>
          <Button type="button" onClick={() => setDialog({ kind: 'add' })}>
            <Plus />
            Track something
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <Input
            aria-label="Search tracked items"
            placeholder="Search"
            className="w-48"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          items={typeItems}
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(String(value))}
        >
          <SelectTrigger className="w-40" aria-label="Filter by type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {typeItems.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={kindItems}
          value={kindFilter}
          onValueChange={(value) => setKindFilter(value as ItemKind | typeof ALL)}
        >
          <SelectTrigger className="w-48" aria-label="Filter by kind">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {kindItems.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {chips.map(({ label, clear }) => (
          <Badge key={label} variant="secondary" className="gap-1">
            {label}
            <button
              type="button"
              aria-label={`Remove filter ${label}`}
              onClick={clear}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading items…
        </p>
      ) : error ? (
        <div className="flex flex-col items-start gap-2" role="alert">
          <p className="text-destructive">Could not load your tracked items.</p>
          <Button type="button" variant="outline" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing tracked yet. Choose Track something to add a book, course or
          lecture series.
        </p>
      ) : (
        <>
          <Summary items={shown} typeName={typeName} />
          {isTruncated && (
            <p className="text-muted-foreground">
              Only the newest items are shown. Stop tracking old ones to see
              more.
            </p>
          )}
          {hidden > 0 && (
            <p className="text-muted-foreground">
              {hidden} cancelled, on hold or archived{' '}
              {hidden === 1 ? 'item is' : 'items are'} not shown.
            </p>
          )}
          {shown.length === 0 ? (
            <p className="text-muted-foreground">
              No items match. Remove a filter to see more.
            </p>
          ) : (
            <kanban.KanbanBoard
              items={shown}
              stages={stages}
              getId={itemKey}
              columnFor={columnFor}
              onMove={(item, stage) => move(item, stage.status)}
              isPending={changes.isPending}
              emptyText="Nothing here"
              renderCard={(item, { previous, next }) => {
                const key = itemKey(item)
                const arrow = (
                  direction: 'previous' | 'next',
                  stage: typeof previous,
                ) => (
                  <kanban.MoveButton
                    direction={direction}
                    stage={stage}
                    disabled={changes.isPending(key)}
                    onMove={(target) => move(item, target.status)}
                  />
                )
                return (
                  <ItemCard
                    item={item}
                    typeName={typeName(item.tracker.type)}
                    taskCounts={taskCounts.get(key)}
                    isPending={changes.isPending(key)}
                    error={changes.errorFor(key)}
                    previous={arrow('previous', previous)}
                    next={arrow('next', next)}
                    onFinish={() => setDialog({ kind: 'finish', item })}
                    onStopTracking={() => void changes.stopTracking(item)}
                  />
                )
              }}
            />
          )}
        </>
      )}

      {dialog?.kind === 'add' && (
        <AddItemDialog
          types={types}
          create={changes.create}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'types' && (
        <TypesDialog
          initial={types}
          save={saveTypes}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'finish' && (
        <FinishDialog
          item={dialog.item}
          nextItems={items.filter(
            (other) =>
              other.tracker.type === dialog.item.tracker.type &&
              other.status === ProgressStatus.PLANNED &&
              itemKey(other) !== itemKey(dialog.item),
          )}
          finish={changes.finish}
          onClose={() => setDialog(null)}
        />
      )}
    </section>
  )
}

/** Per type: how many are in progress, and how many finished this year. */
function Summary({
  items,
  typeName,
}: {
  items: TrackedItem[]
  typeName: (id: string) => string
}) {
  const year = new Date().getFullYear()
  const rows = new Map<string, { active: number; finished: number }>()
  for (const item of items) {
    const name = typeName(item.tracker.type)
    const row = rows.get(name) ?? { active: 0, finished: 0 }
    if (
      item.status === ProgressStatus.IN_PROGRESS ||
      item.status === ProgressStatus.PAUSED
    )
      row.active++
    if (
      item.status === ProgressStatus.COMPLETED &&
      item.completed_at !== null &&
      new Date(item.completed_at).getFullYear() === year
    )
      row.finished++
    rows.set(name, row)
  }
  return (
    <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground">
      {[...rows].map(([name, { active, finished }]) => (
        <li key={name}>
          <span className="font-medium text-foreground">{name}</span>:{' '}
          {active} in progress, {finished} finished in {year}
        </li>
      ))}
    </ul>
  )
}
