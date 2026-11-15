import { Button, Loader2 } from 'unhussle/frontend'
import type { Board, Stage } from './boards'
import {
  columnFor,
  completeChanges,
  moveChanges,
  startChanges,
} from './placement'
import { TASKS_PER_STATUS, useBoardTasks, type BoardTask } from './use-board-tasks'
import { useTaskChanges } from './use-task-changes'
import { KanbanBoard } from './kanban-board'
import { TaskCard } from './task-card'

/** Kanban's own board: the tasks of its sources. */
export function BoardColumns({ board }: { board: Board }) {
  const { tasks, isLoading, error, retry, isTruncated } = useBoardTasks(board)
  const changes = useTaskChanges()

  if (isLoading)
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading tasks…
      </p>
    )
  if (error)
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-destructive">Could not load this board's tasks.</p>
        <Button type="button" variant="outline" onClick={retry}>
          Try again
        </Button>
      </div>
    )

  const move = (task: BoardTask, stage: Stage) =>
    void changes.update(task.id, 'move', moveChanges(task, stage))

  return (
    <div className="flex flex-col gap-4">
      {isTruncated && (
        <p className="text-muted-foreground">
          Some tasks are hidden. Each source shows up to {TASKS_PER_STATUS}{' '}
          tasks per status.
        </p>
      )}
      <KanbanBoard
        items={tasks}
        stages={board.stages}
        getId={(task) => task.id}
        columnFor={(task) => columnFor(task, board.stages)}
        onMove={move}
        isPending={changes.isPending}
        emptyText="No tasks"
        renderCard={(task, { previous, next }) => (
          <TaskCard
            task={task}
            previous={previous}
            next={next}
            isPending={changes.isPending(task.id)}
            error={changes.errorFor(task.id)}
            onMove={(target) => move(task, target)}
            onStart={() =>
              void changes.update(
                task.id,
                'start',
                startChanges(task, board.stages),
              )
            }
            onComplete={() =>
              void changes.update(
                task.id,
                'complete',
                completeChanges(task, board.stages),
              )
            }
            onDelete={() => changes.remove(task.id)}
          />
        )}
      />
    </div>
  )
}
