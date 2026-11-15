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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type EntityRef,
} from 'unhussle/frontend'
import { SOURCE_KINDS, trackerErrors, type Tracker } from './trackers'
import { TRACKER_TYPES, type TrackerTypeId } from './tracker-types'

const typeItems = TRACKER_TYPES.map(({ id, name }) => ({
  value: id,
  label: name,
}))

type TrackerFormProps = {
  initial: Tracker
  isNew: boolean
  onSave: (tracker: Tracker) => Promise<void>
  onClose: () => void
}

export function TrackerForm({
  initial,
  isNew,
  onSave,
  onClose,
}: TrackerFormProps) {
  const [tracker, setTracker] = useState(initial)
  const [showErrors, setShowErrors] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string>()
  const errors = trackerErrors(tracker)
  const visible = showErrors ? errors : {}

  const submit = async (event: React.SubmitEvent) => {
    event.preventDefault()
    setShowErrors(true)
    if (errors.name || errors.sources) return
    setIsSaving(true)
    setSaveError(undefined)
    try {
      await onSave({ ...tracker, name: tracker.name.trim() })
    } catch {
      setSaveError('Could not save this tracker. Try again.')
      setIsSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isNew ? 'New tracker' : `Edit ${initial.name}`}
          </DialogTitle>
          <DialogDescription>
            Shows the projects and goals in its sources. Nothing is created or
            copied.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          onSubmit={submit}
          onBlur={() => setShowErrors(true)}
        >
          <section className="flex flex-col gap-2">
            <Label htmlFor="tracker-name">Name</Label>
            <Input
              id="tracker-name"
              value={tracker.name}
              placeholder="Reading"
              aria-invalid={Boolean(visible.name)}
              onChange={(event) =>
                setTracker({ ...tracker, name: event.target.value })
              }
            />
            {visible.name && (
              <p className="text-sm text-destructive">{visible.name}</p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <Label htmlFor="tracker-type">Tracks</Label>
            <Select
              items={typeItems}
              value={tracker.type}
              onValueChange={(type) =>
                setTracker({ ...tracker, type: type as TrackerTypeId })
              }
            >
              <SelectTrigger
                id="tracker-type"
                className="w-48"
                aria-describedby="tracker-type-hint"
              >
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
            <p id="tracker-type-hint" className="text-sm text-muted-foreground">
              Items that don't count their own progress show finished tasks in
              its unit.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <Label htmlFor="tracker-sources">
              Projects, areas, goals and tags
            </Label>
            <EntityRefsInput
              id="tracker-sources"
              kinds={[...SOURCE_KINDS]}
              value={tracker.sources}
              hasError={Boolean(visible.sources)}
              placeholder="Search to add…"
              onChange={(refs: EntityRef[]) =>
                setTracker({
                  ...tracker,
                  sources: refs.map((ref) => ({
                    kind: ref.kind as Tracker['sources'][number]['kind'],
                    id: ref.id,
                    title: ref.title,
                  })),
                })
              }
            />
            <p className="text-sm text-muted-foreground">
              An area adds its goals and projects. A tag adds the projects and
              goals tagged with it.
            </p>
            {visible.sources && (
              <p className="text-sm text-destructive">{visible.sources}</p>
            )}
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
              {isNew ? 'Create tracker' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
