import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  CardFooter,
  CardTitle,
  CheckCircle2,
  Link,
  Loader2,
  Pencil,
  Play,
  ProgressStatus,
  Trash2,
  getEntityItemRoute,
  openEntityEditor,
} from 'unhussle/frontend'
import type { Stage } from './boards'
import type { BoardTask } from './use-board-tasks'
import { MoveButton } from './kanban-board'

type TaskCardProps = {
  task: BoardTask
  previous?: Stage
  next?: Stage
  isPending: boolean
  error?: string
  onMove: (stage: Stage) => void
  onStart: () => void
  onComplete: () => void
  onDelete: () => Promise<void>
}

export function TaskCard({
  task,
  previous,
  next,
  isPending,
  error,
  onMove,
  onStart,
  onComplete,
  onDelete,
}: TaskCardProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const canStart =
    task.status === ProgressStatus.PLANNED ||
    task.status === ProgressStatus.PAUSED
  const canComplete = task.status !== ProgressStatus.COMPLETED

  return (
    <>
      <Card size="sm">
        <CardContent className="flex flex-col gap-2">
          <CardTitle>
            <Link to={getEntityItemRoute('tasks', task.id)}>{task.title}</Link>
          </CardTitle>
          {task.status === ProgressStatus.PAUSED && (
            <p className="text-muted-foreground">Paused</p>
          )}
          {error && (
            <p className="text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter className="justify-between gap-1">
          <MoveButton
            direction="previous"
            stage={previous}
            disabled={isPending}
            onMove={onMove}
          />
          <div className="flex gap-1">
            {isPending && (
              <Loader2
                className="size-4 animate-spin self-center"
                aria-label="Saving"
              />
            )}
            {canStart && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={isPending}
                aria-label="Start"
                title="Start"
                onClick={onStart}
              >
                <Play />
              </Button>
            )}
            {canComplete && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={isPending}
                aria-label="Complete"
                title="Complete"
                onClick={onComplete}
              >
                <CheckCircle2 />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              aria-label="Edit"
              title="Edit"
              onClick={() => openEntityEditor('tasks', task.id)}
            >
              <Pencil />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isPending}
              aria-label="Delete"
              title="Delete"
              onClick={() => setIsConfirming(true)}
            >
              <Trash2 />
            </Button>
          </div>
          <MoveButton
            direction="next"
            stage={next}
            disabled={isPending}
            onMove={onMove}
          />
        </CardFooter>
      </Card>
      <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              "{task.title}" will be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setIsConfirming(false)
                void onDelete()
              }}
            >
              Delete task
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
