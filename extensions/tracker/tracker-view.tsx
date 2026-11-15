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
import { newTracker, type Tracker } from './trackers'
import { TrackerBoard } from './tracker-board'
import { TrackerForm } from './tracker-form'
import { useTrackers } from './use-trackers'

export function TrackerView() {
  const { state, retry, save } = useTrackers()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<{
    tracker: Tracker
    isNew: boolean
  } | null>(null)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string>()

  if (state.status === 'loading')
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading trackers…
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

  const { trackers } = state
  const tracker =
    trackers.find((candidate) => candidate.id === selectedId) ?? trackers[0]

  const saveTracker = async (next: Tracker) => {
    const exists = trackers.some((candidate) => candidate.id === next.id)
    await save(
      exists
        ? trackers.map((candidate) =>
            candidate.id === next.id ? next : candidate,
          )
        : [...trackers, next],
    )
    setSelectedId(next.id)
    setEditing(null)
  }
  const deleteTracker = async () => {
    setDeleteError(undefined)
    try {
      await save(trackers.filter((candidate) => candidate.id !== tracker?.id))
      setSelectedId(null)
      setIsConfirmingDelete(false)
    } catch {
      setDeleteError('Could not delete this tracker. Try again.')
    }
  }

  return (
    <main className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">Progress</h1>
        {tracker && (
          <>
            <Select
              items={trackers.map(({ id, name }) => ({
                value: id,
                label: name,
              }))}
              value={tracker.id}
              onValueChange={(id) => setSelectedId(id)}
            >
              <SelectTrigger className="w-48" aria-label="Tracker">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {trackers.map(({ id, name }) => (
                  <SelectItem key={id} value={id}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing({ tracker, isNew: false })}
            >
              <Pencil />
              Edit tracker
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmingDelete(true)}
            >
              <Trash2 />
              Delete tracker
            </Button>
          </>
        )}
        <Button
          type="button"
          onClick={() => setEditing({ tracker: newTracker(), isNew: true })}
        >
          <Plus />
          New tracker
        </Button>
      </header>

      {tracker ? (
        <TrackerBoard key={tracker.id} tracker={tracker} />
      ) : (
        <section className="flex flex-col items-start gap-2">
          <h2 className="font-medium">No trackers yet</h2>
          <p className="text-muted-foreground">
            Create a tracker to follow books, courses or lecture series from
            your projects, areas, goals or tags.
          </p>
        </section>
      )}

      {editing && (
        <TrackerForm
          initial={editing.tracker}
          isNew={editing.isNew}
          onSave={saveTracker}
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
            <AlertDialogTitle>Delete this tracker?</AlertDialogTitle>
            <AlertDialogDescription>
              "{tracker?.name}" will be removed. Its projects and goals are not
              changed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Back</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={deleteTracker}>
              Delete tracker
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
