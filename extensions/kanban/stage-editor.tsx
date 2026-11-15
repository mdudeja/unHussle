import {
  ArrowDown,
  ArrowUp,
  Button,
  Input,
  Plus,
  ProgressStatus,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Trash2,
} from 'unhussle/frontend'
import {
  STAGE_STATUSES,
  STATUS_LABELS,
  type Stage,
  type StageErrors,
  type StageStatus,
} from './boards'

const statusItems = STAGE_STATUSES.map((status) => ({
  value: status,
  label: STATUS_LABELS[status],
}))

type StageEditorProps = {
  stages: Stage[]
  /** From `stageErrors`; pass none until the user has tried to save. */
  errors: StageErrors
  onChange: (stages: Stage[]) => void
}

/** Edits stages in order: name, status, move and remove. */
export function StageEditor({ stages, errors, onChange }: StageEditorProps) {
  const updateStage = (index: number, stage: Partial<Stage>) =>
    onChange(
      stages.map((current, at) =>
        at === index ? { ...current, ...stage } : current,
      ),
    )
  const moveStage = (index: number, offset: number) => {
    const next = [...stages]
    const [stage] = next.splice(index, 1)
    next.splice(index + offset, 0, stage)
    onChange(next)
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Stages</legend>
      <p className="text-sm text-muted-foreground">
        Columns, from left to right. Each stage matches a task status.
      </p>
      <ol className="flex flex-col gap-2">
        {stages.map((stage, index) => (
          <li key={index} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Input
                aria-label={`Stage ${index + 1} name`}
                value={stage.name}
                aria-invalid={Boolean(errors.stageNames[index])}
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
                disabled={index === stages.length - 1}
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
                  onChange(stages.filter((_, at) => at !== index))
                }
              >
                <Trash2 />
              </Button>
            </div>
            {errors.stageNames[index] && (
              <p className="text-sm text-destructive">
                {errors.stageNames[index]}
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
          onChange([
            ...stages,
            { name: '', status: ProgressStatus.IN_PROGRESS },
          ])
        }
      >
        <Plus />
        Add stage
      </Button>
      {errors.stages && (
        <p className="text-sm text-destructive">{errors.stages}</p>
      )}
    </fieldset>
  )
}
