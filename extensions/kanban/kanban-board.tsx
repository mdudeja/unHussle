import { useState, type ReactNode } from 'react'
import { Badge, Button, ChevronLeft, ChevronRight } from 'unhussle/frontend'
import type { Stage } from './boards'

const DRAG_TYPE = 'application/x-unhussle-kanban-item'

export type KanbanBoardProps<Item> = {
  items: readonly Item[]
  stages: readonly Stage[]
  getId: (item: Item) => string
  /** The item's stage index; -1 hides it. */
  columnFor: (item: Item) => number
  onMove: (item: Item, stage: Stage) => void
  isPending?: (id: string) => boolean
  /** The neighbouring stages are for `MoveButton`s on the card. */
  renderCard: (
    item: Item,
    neighbours: { previous?: Stage; next?: Stage },
  ) => ReactNode
  /** Shown in an empty column, such as "No tasks". */
  emptyText: string
}

/** Columns of stages; cards move by dragging or with `MoveButton`s. */
export function KanbanBoard<Item>({
  items,
  stages,
  getId,
  columnFor,
  onMove,
  isPending = () => false,
  renderCard,
  emptyText,
}: KanbanBoardProps<Item>) {
  const [dropTarget, setDropTarget] = useState<string | null>(null)
  const columns = stages.map((stage) => ({ stage, items: [] as Item[] }))
  for (const item of items) columns[columnFor(item)]?.items.push(item)

  const drop = (id: string, index: number) => {
    const item = items.find((candidate) => getId(candidate) === id)
    if (item && columnFor(item) !== index) onMove(item, stages[index])
  }

  return (
    <ol className="flex gap-4 overflow-x-auto pb-2">
      {columns.map(({ stage, items: cards }, index) => (
        <li
          key={stage.name}
          data-drop-target={dropTarget === stage.name}
          className="flex w-72 shrink-0 flex-col gap-3 rounded-xl bg-muted p-3 data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-ring"
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes(DRAG_TYPE)) return
            event.preventDefault()
            setDropTarget(stage.name)
          }}
          onDragLeave={() => setDropTarget(null)}
          onDrop={(event) => {
            event.preventDefault()
            setDropTarget(null)
            drop(event.dataTransfer.getData(DRAG_TYPE), index)
          }}
        >
          <header className="flex items-center justify-between gap-2">
            <h2 className="font-medium">{stage.name}</h2>
            <Badge variant="secondary">{cards.length}</Badge>
          </header>
          {cards.length ? (
            <ul className="flex flex-col gap-2">
              {cards.map((item) => {
                const id = getId(item)
                return (
                  <li
                    key={id}
                    draggable={!isPending(id)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(DRAG_TYPE, id)
                      event.dataTransfer.effectAllowed = 'move'
                    }}
                  >
                    {renderCard(item, {
                      previous: stages[index - 1],
                      next: stages[index + 1],
                    })}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {emptyText}. Drag a card here to move it.
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}

/** Moves a card one stage back or forward; disabled at either end. */
export function MoveButton({
  direction,
  stage,
  disabled = false,
  onMove,
}: {
  direction: 'previous' | 'next'
  stage?: Stage
  disabled?: boolean
  onMove: (stage: Stage) => void
}) {
  const label = stage
    ? `Move to ${stage.name}`
    : direction === 'previous'
      ? 'This is the first stage'
      : 'This is the last stage'
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={!stage || disabled}
      aria-label={label}
      title={label}
      onClick={() => stage && onMove(stage)}
    >
      {direction === 'previous' ? <ChevronLeft /> : <ChevronRight />}
    </Button>
  )
}
