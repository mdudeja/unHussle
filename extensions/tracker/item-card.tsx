import { useState, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
  Trash2,
  getEntityItemRoute,
  openEntityEditor,
} from 'unhussle/frontend'
import { KIND_LABELS, isCounting, type TrackedItem } from './items'
import type { TaskCounts } from './use-items'

type ItemCardProps = {
  item: TrackedItem
  typeName: string
  taskCounts?: TaskCounts
  isPending: boolean
  error?: string
  /** `MoveButton`s for the neighbouring stages. */
  previous: ReactNode
  next: ReactNode
  onFinish: () => void
  onStopTracking: () => void
}

/** A tracked item: its progress, Finish, and a menu with the rest. */
export function ItemCard({
  item,
  typeName,
  taskCounts,
  isPending,
  error,
  previous,
  next,
  onFinish,
  onStopTracking,
}: ItemCardProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const finished = item.status === ProgressStatus.COMPLETED
  const { rating } = item.tracker

  return (
    <>
      <Card size="sm">
        <CardContent className="flex flex-col gap-2">
          <CardTitle>
            <Link to={getEntityItemRoute(item.kind, item.id)}>
              {item.title}
            </Link>
          </CardTitle>
          <p className="flex flex-wrap gap-1">
            <Badge variant="secondary">{typeName}</Badge>
            <Badge variant="outline">{KIND_LABELS[item.kind]}</Badge>
          </p>
          {isCounting(item) ? (
            <ItemProgress item={item} />
          ) : taskCounts ? (
            <p className="text-sm text-muted-foreground">
              {taskCounts.total
                ? `${taskCounts.done} / ${taskCounts.total} tasks done`
                : 'No tasks yet. Add tasks, or edit it to count units.'}
            </p>
          ) : null}
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
              <Loader2
                className="size-4 animate-spin"
                aria-label="Saving"
              />
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
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setIsConfirming(true)}
                >
                  <Trash2 />
                  Stop tracking
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {next}
        </CardFooter>
      </Card>
      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop tracking {item.title}?</AlertDialogTitle>
            <AlertDialogDescription>
              It leaves this board, along with its rating and summary. The{' '}
              {KIND_LABELS[item.kind].toLowerCase()}, its tasks and its
              progress stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setIsConfirming(false)
                onStopTracking()
              }}
            >
              Stop tracking
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
