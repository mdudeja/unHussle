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
  ProgressInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type EntityRef,
} from 'unhussle/frontend'
import { INPUT_ITEMS, defaultInput, type ItemType } from './item-types'
import { KIND_LABELS, type ItemKind } from './items'
import type { NewItem } from './use-item-changes'

const kindItems = (Object.keys(KIND_LABELS) as ItemKind[]).map((kind) => ({
  value: kind,
  label:
    kind === 'projects'
      ? 'Project: one thing to finish, like a book'
      : 'Goal: a target, like 1000 pages this month',
}))

type Draft = {
  kind: ItemKind
  title: string
  typeId: string
  total: string
  /** Only once the user picks one; otherwise the default below. */
  input: ProgressInput | null
  tasks: EntityRef[]
}

function draftErrors({ title, total }: Draft) {
  const count = Number(total)
  return {
    title: title.trim() ? undefined : 'Enter a name.',
    total:
      total.trim() && (!Number.isInteger(count) || count < 1)
        ? 'Enter a whole number of 1 or more, or leave it empty.'
        : undefined,
  }
}

type AddItemDialogProps = {
  types: ItemType[]
  create: (item: NewItem) => Promise<void>
  onClose: () => void
}

export function AddItemDialog({ types, create, onClose }: AddItemDialogProps) {
  const [draft, setDraft] = useState<Draft>({
    kind: 'projects',
    title: '',
    typeId: types[0].id,
    total: '',
    input: null,
    tasks: [],
  })
  const [showErrors, setShowErrors] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const errors = draftErrors(draft)
  const visible = showErrors ? errors : { title: undefined, total: undefined }
  const type = types.find(({ id }) => id === draft.typeId) ?? types[0]
  const typeItems = types.map(({ id, name }) => ({ value: id, label: name }))
  const input = draft.input ?? defaultInput(draft.kind, type)

  const submit = async (event: React.SubmitEvent) => {
    event.preventDefault()
    setShowErrors(true)
    if (errors.title || errors.total) return
    setIsSaving(true)
    setSaveError(undefined)
    try {
      await create({
        kind: draft.kind,
        title: draft.title.trim(),
        type: type.id,
        count: draft.total.trim()
          ? { total: Number(draft.total), unit: type.unit, input }
          : undefined,
        taskIds: draft.tasks.map(({ id }) => id),
      })
      onClose()
    } catch (err) {
      setSaveError(
        `${err instanceof Error ? err.message : 'Could not add this item'}. Try again.`,
      )
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Track something new</DialogTitle>
          <DialogDescription>
            A book, course or lecture series, as a project or a goal.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={submit}
          onBlur={() => setShowErrors(true)}
        >
          <section className="flex flex-col gap-2">
            <Label htmlFor="tracker-kind">Track as</Label>
            <Select
              items={kindItems}
              value={draft.kind}
              onValueChange={(kind) =>
                setDraft({ ...draft, kind: kind as ItemKind })
              }
            >
              <SelectTrigger id="tracker-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {kindItems.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
          <section className="flex flex-col gap-2">
            <Label htmlFor="tracker-title">Name</Label>
            <Input
              id="tracker-title"
              value={draft.title}
              placeholder={
                draft.kind === 'projects' ? 'Dune' : 'Read 1000 pages this month'
              }
              aria-invalid={Boolean(visible.title)}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
            />
            {visible.title && (
              <p className="text-sm text-destructive">{visible.title}</p>
            )}
          </section>
          <section className="flex flex-col gap-2">
            <Label htmlFor="tracker-type">Type</Label>
            <Select
              items={typeItems}
              value={draft.typeId}
              onValueChange={(typeId) =>
                setDraft({ ...draft, typeId: String(typeId) })
              }
            >
              <SelectTrigger id="tracker-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeItems.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
          <section className="flex flex-col gap-2">
            <Label htmlFor="tracker-total">Total {type.unit}</Label>
            <Input
              id="tracker-total"
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              className="w-40"
              value={draft.total}
              placeholder="Optional"
              aria-invalid={Boolean(visible.total)}
              aria-describedby="tracker-total-hint"
              onChange={(event) =>
                setDraft({ ...draft, total: event.target.value })
              }
            />
            <p
              id="tracker-total-hint"
              className="text-sm text-muted-foreground"
            >
              Leave empty to count its finished tasks instead.
            </p>
            {visible.total && (
              <p className="text-sm text-destructive">{visible.total}</p>
            )}
          </section>
          {draft.total.trim() && (
            <section className="flex flex-col gap-2">
              <Label htmlFor="tracker-input">Record</Label>
              <Select
                items={INPUT_ITEMS}
                value={input}
                onValueChange={(value) =>
                  setDraft({ ...draft, input: value as ProgressInput })
                }
              >
                <SelectTrigger
                  id="tracker-input"
                  className="w-48"
                  aria-describedby="tracker-input-hint"
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
              <p
                id="tracker-input-hint"
                className="text-sm text-muted-foreground"
              >
                {input === ProgressInput.POSITION
                  ? `Each time, you enter where you got to, out of the total ${type.unit}.`
                  : `Each time, you enter how many ${type.unit} you did.`}
              </p>
            </section>
          )}
          <section className="flex flex-col gap-2">
            <Label htmlFor="tracker-tasks">Tasks that count for it</Label>
            <EntityRefsInput
              id="tracker-tasks"
              kinds={['tasks']}
              value={draft.tasks}
              placeholder="Search tasks, such as a daily Read…"
              onChange={(tasks: EntityRef[]) => setDraft({ ...draft, tasks })}
            />
            <p className="text-sm text-muted-foreground">
              Each time you complete one, its time counts here.
            </p>
          </section>
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
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
