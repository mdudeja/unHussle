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
  Loader2,
  Pencil,
  Plus,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Trash2,
} from 'unhussle/frontend'
import { DEFAULT_STAGES, type Board } from './boards'
import { BoardColumns } from './board-columns'
import { BoardForm } from './board-form'
import { useBoards } from './use-boards'

const newBoard = (): Board => ({
  id: crypto.randomUUID(),
  name: '',
  sources: [],
  stages: DEFAULT_STAGES,
})

export function KanbanView() {
  const { state, retry, save } = useBoards()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{
    board: Board
    isNew: boolean
  } | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string>()

  if (state.status === 'loading')
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading boards…
      </p>
    )
  if (state.status === 'error')
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-destructive">{state.message}</p>
        <Button type="button" variant="outline" onClick={retry}>
          Try again
        </Button>
      </div>
    )

  const { boards } = state
  const board =
    boards.find((candidate) => candidate.id === selectedId) ?? boards[0]

  const saveBoard = async (next: Board) => {
    const exists = boards.some((candidate) => candidate.id === next.id)
    await save(
      exists
        ? boards.map((candidate) =>
            candidate.id === next.id ? next : candidate,
          )
        : [...boards, next],
    )
    setSelectedId(next.id)
    setEditing(null)
  }
  const deleteBoard = async () => {
    setDeleteError(undefined)
    try {
      await save(boards.filter((candidate) => candidate.id !== board?.id))
      setSelectedId(null)
      setIsConfirmingDelete(false)
    } catch {
      setDeleteError('Could not delete this board. Try again.')
    }
  }

  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Kanban</h1>
        {board && (
          <>
            <Select
              items={boards.map(({ id, name }) => ({ value: id, label: name }))}
              value={board.id}
              onValueChange={(id) => setSelectedId(id)}
            >
              <SelectTrigger className="w-48" aria-label="Board">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {boards.map(({ id, name }) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing({ board, isNew: false })}
            >
              <Pencil />
              Edit board
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmingDelete(true)}
            >
              <Trash2 />
              Delete board
            </Button>
          </>
        )}
        <Button
          type="button"
          onClick={() => setEditing({ board: newBoard(), isNew: true })}
        >
          <Plus />
          New board
        </Button>
      </header>

      {board ? (
        <BoardColumns key={board.id} board={board} />
      ) : (
        <section className="flex flex-col items-start gap-2">
          <h2 className="font-medium">No boards yet</h2>
          <p className="text-muted-foreground">
            Create a board to see tasks from your projects, areas, goals or tags
            as columns of stages.
          </p>
        </section>
      )}

      {editing && (
        <BoardForm
          initial={editing.board}
          isNew={editing.isNew}
          onSave={saveBoard}
          onClose={() => setEditing(null)}
        />
      )}
      <AlertDialog
        open={isConfirmingDelete}
        onOpenChange={(open) => {
          setIsConfirmingDelete(open)
          setDeleteError(undefined)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this board?</AlertDialogTitle>
            <AlertDialogDescription>
              "{board?.name}" will be removed. Its tasks are not changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={deleteBoard}>
              Delete board
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
