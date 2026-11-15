import { useState } from 'react'
import {
  Badge,
  Button,
  Input,
  Loader2,
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
import { KIND_LABELS, itemKey, type ItemKind, type TrackerItem } from './items'
import { ItemCard } from './item-card'
import { FinishDialog } from './finish-dialog'
import { nextItems } from './next-items'
import { trackerType } from './tracker-types'
import type { Tracker } from './trackers'
import { useItemChanges } from './use-item-changes'
import { useTrackerItems } from './use-tracker-items'

const ALL = 'all'
const kindItems = [
  { value: ALL, label: 'Projects and goals' },
  ...(Object.keys(KIND_LABELS) as ItemKind[]).map((kind) => ({
    value: kind,
    label: `${KIND_LABELS[kind]}s`,
  })),
]

/** One tracker's projects and goals as columns of their status. */
export function TrackerBoard({ tracker }: { tracker: Tracker }) {
  const { kanban } = useTracker()
  const {
    items,
    taskCounts,
    countsError,
    isLoading,
    error,
    retry,
    isTruncated,
  } = useTrackerItems(tracker)
  const changes = useItemChanges()
  const [search, setSearch] = useState('')
  const [kindFilter, setKindFilter] = useState<ItemKind | typeof ALL>(ALL)
  const [finishing, setFinishing] = useState<TrackerItem | null>(null)
  const { unit } = trackerType(tracker.type)

  if (isLoading)
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading items…
      </p>
    )
  if (error)
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-destructive">Could not load this tracker's items.</p>
        <Button type="button" variant="outline" onClick={retry}>
          Try again
        </Button>
      </div>
    )
  if (!items.length)
    return (
      <p className="text-muted-foreground">
        Its sources hold no projects or goals yet. Add some to them, or edit the
        tracker to pick other sources.
      </p>
    )

  const term = search.trim().toLowerCase()
  const shown = items.filter(
    (item) =>
      (kindFilter === ALL || item.kind === kindFilter) &&
      (!term || item.title.toLowerCase().includes(term)),
  )
  const stages = kanban.DEFAULT_STAGES
  const columnFor = (item: TrackerItem) => kanban.columnFor(item, stages)
  const hidden = shown.filter((item) => columnFor(item) < 0).length
  const chips = [
    ...(kindFilter === ALL
      ? []
      : [
          {
            label: `${KIND_LABELS[kindFilter]}s`,
            clear: () => setKindFilter(ALL),
          },
        ]),
    ...(term
      ? [{ label: `"${search.trim()}"`, clear: () => setSearch('') }]
      : []),
  ]

  // Moving to Completed asks for a rating first, like Finish.
  const move = (item: TrackerItem, status: ProgressStatus) =>
    status === ProgressStatus.COMPLETED
      ? setFinishing(item)
      : void changes.move(item, status)

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <Input
            aria-label="Search this tracker"
            placeholder="Search"
            className="w-48"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select
          items={kindItems}
          value={kindFilter}
          onValueChange={(value) =>
            setKindFilter(value as ItemKind | typeof ALL)
          }
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

      <Summary items={shown} />
      {isTruncated && (
        <p className="text-muted-foreground">
          Only the first {items.length} items are shown. Narrow the sources to
          see the rest.
        </p>
      )}
      {hidden > 0 && (
        <p className="text-muted-foreground">
          {hidden} cancelled, on hold or archived{' '}
          {hidden === 1 ? 'item is' : 'items are'} not shown.
        </p>
      )}
      {countsError && (
        <p className="text-destructive" role="alert">
          Could not count some items' tasks. Reload the page to try again.
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
                unit={unit}
                taskCounts={taskCounts.get(key)}
                isPending={changes.isPending(key)}
                error={changes.errorFor(key)}
                previous={arrow('previous', previous)}
                next={arrow('next', next)}
                onFinish={() => setFinishing(item)}
              />
            )
          }}
        />
      )}

      {finishing && (
        <FinishDialog
          item={finishing}
          nextItems={nextItems(finishing, items)}
          finish={changes.finish}
          onClose={() => setFinishing(null)}
        />
      )}
    </section>
  )
}

/** How many are in progress, and how many finished this year. */
function Summary({ items }: { items: TrackerItem[] }) {
  const year = new Date().getFullYear()
  const active = items.filter(
    ({ status }) =>
      status === ProgressStatus.IN_PROGRESS || status === ProgressStatus.PAUSED,
  ).length
  const finished = items.filter(
    ({ status, completed_at }) =>
      status === ProgressStatus.COMPLETED &&
      completed_at !== null &&
      new Date(completed_at).getFullYear() === year,
  ).length
  return (
    <p className="text-sm text-muted-foreground">
      {active} in progress, {finished} finished in {year}
    </p>
  )
}
