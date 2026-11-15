import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EntityRefsInput,
  Input,
  Label,
  Loader2,
  type EntityRef,
} from 'unhussle/frontend'
import {
  SOURCE_KINDS,
  boardErrors,
  hasErrors,
  type Board,
  type BoardSource,
} from './boards'
import { StageEditor } from './stage-editor'

type BoardFormProps = {
  initial: Board
  isNew: boolean
  onSave: (board: Board) => Promise<void>
  onClose: () => void
}

export function BoardForm({ initial, isNew, onSave, onClose }: BoardFormProps) {
  const [board, setBoard] = useState(initial)
  const [showErrors, setShowErrors] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const errors = boardErrors(board)
  const visible = showErrors ? errors : { stageNames: [] }

  const submit = async (event: React.SubmitEvent) => {
    event.preventDefault()
    setShowErrors(true)
    if (hasErrors(errors)) return
    setIsSaving(true)
    setSaveError(undefined)
    try {
      await onSave({
        ...board,
        name: board.name.trim(),
        stages: board.stages.map((stage) => ({
          ...stage,
          name: stage.name.trim(),
        })),
      })
    } catch {
      setSaveError('Could not save this board. Try again.')
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isNew ? 'New board' : `Edit ${initial.name}`}
          </DialogTitle>
          <DialogDescription>
            Pick where tasks come from and the stages they move through.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={submit}
          onBlur={() => setShowErrors(true)}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="kanban-board-name">Name</Label>
            <Input
              id="kanban-board-name"
              value={board.name}
              aria-invalid={Boolean(visible.name)}
              onChange={(event) =>
                setBoard({ ...board, name: event.target.value })
              }
            />
            {visible.name && (
              <p className="text-sm text-destructive">{visible.name}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="kanban-board-sources">
              Projects, areas, goals and tags
            </Label>
            <EntityRefsInput
              id="kanban-board-sources"
              kinds={[...SOURCE_KINDS]}
              value={board.sources}
              hasError={Boolean(visible.sources)}
              placeholder="Search to add…"
              onChange={(refs: EntityRef[]) =>
                setBoard({
                  ...board,
                  sources: refs.map((ref): BoardSource => ({
                    kind: ref.kind as BoardSource['kind'],
                    id: ref.id,
                    title: ref.title,
                  })),
                })
              }
            />
            {visible.sources && (
              <p className="text-sm text-destructive">{visible.sources}</p>
            )}
          </div>

          <StageEditor
            stages={board.stages}
            errors={visible}
            onChange={(stages) => setBoard({ ...board, stages })}
          />

          {saveError && (
            <p className="text-sm text-destructive" role="alert">
              {saveError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              {isNew ? 'Create board' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
