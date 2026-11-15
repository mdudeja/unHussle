import { useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
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
  Plus,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Trash2,
  ProgressStatus,
  type EntityRef,
} from 'unhussle/frontend'
import {
  STAGE_STATUSES,
  STATUS_LABELS,
  SOURCE_KINDS,
  boardErrors,
  hasErrors,
  type Board,
  type BoardSource,
  type Stage,
  type StageStatus,
} from './boards'

const statusItems = STAGE_STATUSES.map((status) => ({
  value: status,
  label: STATUS_LABELS[status],
}))

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

  const setStages = (stages: Stage[]) => setBoard({ ...board, stages })
  const updateStage = (index: number, stage: Partial<Stage>) =>
    setStages(
      board.stages.map((current, at) =>
        at === index ? { ...current, ...stage } : current,
      ),
    )
  const moveStage = (index: number, offset: number) => {
    const stages = [...board.stages]
    const [stage] = stages.splice(index, 1)
    stages.splice(index + offset, 0, stage)
    setStages(stages)
  }

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

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium">Stages</legend>
            <p className="text-sm text-muted-foreground">
              Columns, from left to right. Each stage matches a task status.
            </p>
            <ol className="flex flex-col gap-2">
              {board.stages.map((stage, index) => (
                <li key={index} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label={`Stage ${index + 1} name`}
                      value={stage.name}
                      aria-invalid={Boolean(visible.stageNames[index])}
                      onChange={(event) =>
                        updateStage(index, { name: event.target.value })
                      }
                    />
                    <Select
                      items={statusItems}
                      value={stage.status}
                      onValueChange={(status) =>
                        updateStage(index, { status: status as StageStatus })
                      }
                    >
                      <SelectTrigger
                        className="w-36 shrink-0"
                        aria-label={`Stage ${index + 1} status`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusItems.map((item) => (
                          <SelectItem key={item.value} value={item.value}>
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0}
                      aria-label="Move stage up"
                      onClick={() => moveStage(index, -1)}
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === board.stages.length - 1}
                      aria-label="Move stage down"
                      onClick={() => moveStage(index, 1)}
                    >
                      <ArrowDown />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove stage"
                      onClick={() =>
                        setStages(board.stages.filter((_, at) => at !== index))
                      }
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {visible.stageNames[index] && (
                    <p className="text-sm text-destructive">
                      {visible.stageNames[index]}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() =>
                setStages([
                  ...board.stages,
                  { name: '', status: ProgressStatus.IN_PROGRESS },
                ])
              }
            >
              <Plus />
              Add stage
            </Button>
            {visible.stages && (
              <p className="text-sm text-destructive">{visible.stages}</p>
            )}
          </fieldset>

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
