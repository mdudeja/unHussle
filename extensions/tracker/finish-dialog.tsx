import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Loader2,
  ProgressStatus,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useExtensionContainers,
} from 'unhussle/frontend'
import { RATINGS, itemKey, type TrackedItem, type TrackerData } from './items'
import type { useItemChanges } from './use-item-changes'

const NO_RATING = 'none'
const KEEP = 'keep'
/** Enough to find an item's habit tasks. */
const TASKS_READ = 100

type FinishDialogProps = {
  item: TrackedItem
  /** Planned items of the same type, to hand a habit task on to. */
  nextItems: TrackedItem[]
  finish: ReturnType<typeof useItemChanges>['finish']
  onClose: () => void
}

export function FinishDialog({
  item,
  nextItems,
  finish,
  onClose,
}: FinishDialogProps) {
  const tasks = useExtensionContainers([
    { kind: item.kind, id: item.id, options: { limit: TASKS_READ } },
  ])
  const habits = (tasks.data?.[0]?.tasks.items ?? []).filter(
    (task) =>
      task.is_recurring &&
      task.status !== ProgressStatus.COMPLETED &&
      task.status !== ProgressStatus.CANCELLED,
  )
  const [rating, setRating] = useState(NO_RATING)
  const [summary, setSummary] = useState(item.tracker.summary ?? '')
  const [handOver, setHandOver] = useState(KEEP)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string>()

  const submit = async (event: React.SubmitEvent) => {
    event.preventDefault()
    setIsSaving(true)
    setError(undefined)
    const result: Pick<TrackerData, 'rating' | 'summary'> = {
      ...(rating !== NO_RATING && { rating: Number(rating) }),
      ...(summary.trim() && { summary: summary.trim() }),
    }
    const to = nextItems.find((next) => itemKey(next) === handOver)
    try {
      await finish(
        item,
        result,
        to && { taskIds: habits.map(({ id }) => id), to },
      )
      onClose()
    } catch (err) {
      setError(
        `${err instanceof Error ? err.message : 'Could not finish this item'}. Try again.`,
      )
      setIsSaving(false)
    }
  }

  const ratingItems = [
    { value: NO_RATING, label: 'No rating' },
    ...RATINGS.map((value) => ({ value: String(value), label: `${value} / 5` })),
  ]
  const handOverItems = [
    { value: KEEP, label: `Keep it on ${item.title}` },
    ...nextItems.map((next) => ({ value: itemKey(next), label: next.title })),
  ]

  return (
    <Dialog open onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Finish {item.title}</DialogTitle>
          <DialogDescription>
            It moves to Completed. A rating and summary are optional.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <section className="flex flex-col gap-2">
            <Label htmlFor="tracker-rating">Rating</Label>
            <Select
              items={ratingItems}
              value={rating}
              onValueChange={(value) => setRating(String(value))}
            >
              <SelectTrigger id="tracker-rating" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ratingItems.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
          <section className="flex flex-col gap-2">
            <Label htmlFor="tracker-summary">Summary</Label>
            <Textarea
              id="tracker-summary"
              value={summary}
              placeholder="What you took from it"
              onChange={(event) => setSummary(event.target.value)}
            />
          </section>
          {habits.length > 0 && nextItems.length > 0 && (
            <section className="flex flex-col gap-2">
              <Label htmlFor="tracker-hand-over">
                Keep {habits.map(({ title }) => title).join(', ')} going with
              </Label>
              <Select
                items={handOverItems}
                value={handOver}
                onValueChange={(value) => setHandOver(String(value))}
              >
                <SelectTrigger id="tracker-hand-over">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {handOverItems.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                Its next sessions count for the item you pick.
              </p>
            </section>
          )}
          {tasks.error && (
            <p className="text-sm text-destructive" role="alert">
              Could not check this item's habit tasks. You can still finish it.
            </p>
          )}
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
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
              Finish
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
