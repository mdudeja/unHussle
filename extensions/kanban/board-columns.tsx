import { useState } from 'react'
import { Badge, Button, Loader2 } from 'unhussle/frontend'
import type { Board, Stage } from './boards'
import { completeChanges, moveChanges, startChanges } from './placement'
import {
  TASKS_PER_STATUS,
  useBoardTasks,
  type BoardTask,
} from './use-board-tasks'
import { useTaskChanges } from './use-task-changes'
import { TASK_DRAG_TYPE, TaskCard } from './task-card'

export function BoardColumns({ board }: { board: Board }) {
  const { columns, isLoading, error, retry, isTruncated } = useBoardTasks(board)
  const changes = useTaskChanges()
  const [dropTarget, setDropTarget] = useState<string | null>(null)

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
    changes.update(task.id, 'move', moveChanges(task, stage))
  const drop = (taskId: string, index: number) => {
    const from = columns.findIndex((column) =>
      column.tasks.some((task) => task.id === taskId),
    )
    const task = columns[from]?.tasks.find(
      (candidate) => candidate.id === taskId,
    )
    if (task && from !== index) void move(task, columns[index].stage)
  }

  return (
    <div className="flex flex-col gap-4">
      {isTruncated && (
        <p className="text-muted-foreground">
          Some tasks are hidden. Each source shows up to {TASKS_PER_STATUS}{' '}
          tasks per status.
        </p>
      )}
      <ol className="flex gap-4 overflow-x-auto pb-2">
        {columns.map(({ stage, tasks }, index) => (
          <li
            key={stage.name}
            data-drop-target={dropTarget === stage.name}
            className="flex w-72 shrink-0 flex-col gap-3 rounded-xl bg-muted p-3 data-[drop-target=true]:ring-2 data-[drop-target=true]:ring-ring"
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(TASK_DRAG_TYPE)) return
              event.preventDefault()
              setDropTarget(stage.name)
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={(event) => {
              event.preventDefault()
              setDropTarget(null)
              drop(event.dataTransfer.getData(TASK_DRAG_TYPE), index)
            }}
          >
            <header className="flex items-center justify-between gap-2">
              <h2 className="font-medium">{stage.name}</h2>
              <Badge variant="secondary">{tasks.length}</Badge>
            </header>
            {tasks.length ? (
              <ul className="flex flex-col gap-2">
                {tasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    previous={columns[index - 1]?.stage}
                    next={columns[index + 1]?.stage}
                    isPending={changes.isPending(task.id)}
                    error={changes.errorFor(task.id)}
                    onMove={(target) => void move(task, target)}
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
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No tasks. Drag a card here to move it.
              </p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
