import type { ReactNode } from 'react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  ItemProgress,
  Link,
  Loader2,
  MoreHorizontal,
  Pencil,
  ProgressStatus,
  SpentTimeMeta,
  getEntityItemRoute,
  openEntityEditor,
} from 'unhussle/frontend'
import { KIND_LABELS, isCounting, type TrackerItem } from './items'
import type { TaskCounts } from './use-tracker-items'

type ItemCardProps = {
  item: TrackerItem
  /** Labels task counts, such as "4 / 12 lectures". */
  unit: string
  taskCounts?: TaskCounts
  isPending: boolean
  error?: string
  /** `MoveButton`s for the neighbouring stages. */
  previous: ReactNode
  next: ReactNode
  onFinish: () => void
}

/** A tracker item: its progress, Finish, and a menu with the rest. */
export function ItemCard({
  item,
  unit,
  taskCounts,
  isPending,
  error,
  previous,
  next,
  onFinish,
}: ItemCardProps) {
  const finished = item.status === ProgressStatus.COMPLETED
  const { rating } = item.tracker

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <CardTitle>
          <Link to={getEntityItemRoute(item.kind, item.id)}>{item.title}</Link>
        </CardTitle>
        <Badge variant="outline">{KIND_LABELS[item.kind]}</Badge>
        {isCounting(item) ? (
          <ItemProgress item={item} />
        ) : taskCounts ? (
          <p className="text-sm text-muted-foreground">
            {taskCounts.total
              ? `${taskCounts.done} / ${taskCounts.total} ${unit}`
              : 'No tasks yet. Add tasks, or edit it to count units.'}
          </p>
        ) : null}
        {Boolean(item.spent_minutes) && (
          <p className="text-sm text-muted-foreground">
            <SpentTimeMeta minutes={item.spent_minutes} />
          </p>
        )}
        {finished && rating !== undefined && (
          <p className="text-sm text-muted-foreground">Rated {rating} / 5</p>
        )}
        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </CardContent>
      <CardFooter className="justify-between gap-1">
        {previous}
        <div className="flex items-center gap-1">
          {isPending && (
            <Loader2 className="size-4 animate-spin" aria-label="Saving" />
          )}
          {!finished && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={onFinish}
            >
              Finish
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={isPending}
                  aria-label={`More actions for ${item.title}`}
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto">
              <DropdownMenuItem
                onClick={() => openEntityEditor(item.kind, item.id)}
              >
                <Pencil />
                Edit
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {next}
      </CardFooter>
    </Card>
  )
}
