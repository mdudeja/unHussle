import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Loader2,
  Plus,
  ProgressInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Trash2,
} from 'unhussle/frontend'
import {
  INPUT_ITEMS,
  hasTypeErrors,
  typeErrors,
  type ItemType,
} from './item-types'

type TypesDialogProps = {
  initial: ItemType[]
  save: (types: ItemType[]) => Promise<void>
  onClose: () => void
}

/** Edits the kinds of thing to track and their default units. */
export function TypesDialog({ initial, save, onClose }: TypesDialogProps) {
  const [types, setTypes] = useState(initial)
  const [showErrors, setShowErrors] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const errors = typeErrors(types)
  const visible = showErrors ? errors : { rows: [] }

  const update = (index: number, changes: Partial<ItemType>) =>
    setTypes(
      types.map((type, at) => (at === index ? { ...type, ...changes } : type)),
    )

  const submit = async (event: React.SubmitEvent) => {
    event.preventDefault()
    setShowErrors(true)
    if (hasTypeErrors(errors)) return
    setIsSaving(true)
    setSaveError(undefined)
    try {
      await save(
        types.map((type) => ({
          ...type,
          name: type.name.trim(),
          unit: type.unit.trim(),
        })),
      )
      onClose()
    } catch {
      setSaveError('Could not save the types. Try again.')
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Item types</DialogTitle>
          <DialogDescription>
            New items take their unit and how progress is recorded from their
            type. Items of a removed type show as Other.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={submit}
          onBlur={() => setShowErrors(true)}
        >
          <ol className="flex flex-col gap-2">
            {types.map((type, index) => (
              <li key={type.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Type ${index + 1} name`}
                    placeholder="Podcast"
                    value={type.name}
                    aria-invalid={Boolean(visible.rows[index])}
                    onChange={(event) =>
                      update(index, { name: event.target.value })
                    }
                  />
                  <Input
                    aria-label={`Type ${index + 1} unit`}
                    placeholder="episodes"
                    className="w-32 shrink-0"
                    value={type.unit}
                    onChange={(event) =>
                      update(index, { unit: event.target.value })
                    }
                  />
                  <Select
                    items={INPUT_ITEMS}
                    value={type.input}
                    onValueChange={(input) =>
                      update(index, { input: input as ProgressInput })
                    }
                  >
                    <SelectTrigger
                      className="w-40 shrink-0"
                      aria-label={`Type ${index + 1} records`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INPUT_ITEMS.map(({ value, label }) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove type ${index + 1}`}
                    onClick={() =>
                      setTypes(types.filter((_, at) => at !== index))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
                {visible.rows[index] && (
                  <p className="text-sm text-destructive">
                    {visible.rows[index]}
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
              setTypes([
                ...types,
                {
                  id: crypto.randomUUID(),
                  name: '',
                  unit: '',
                  input: ProgressInput.POSITION,
                },
              ])
            }
          >
            <Plus />
            Add type
          </Button>
          {showErrors && errors.list && (
            <p className="text-sm text-destructive">{errors.list}</p>
          )}
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
              Save types
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
