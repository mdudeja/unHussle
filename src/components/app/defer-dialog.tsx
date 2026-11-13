import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Logger } from '@c/Logger'

type DeferDialogProps = {
  title: string
  /** The earliest date allowed, and the one suggested. */
  earliest: string
  onConfirm: (until: string) => Promise<void>
  onClose: () => void
}

/** Asks when a task should be available again, then postpones it. */
export function DeferDialog({
  title,
  earliest,
  onConfirm,
  onClose,
}: DeferDialogProps) {
  const [until, setUntil] = useState(earliest)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isValid = until >= earliest

  const confirm = async () => {
    setIsBusy(true)
    setError(null)
    try {
      await onConfirm(until)
      onClose()
    } catch (err) {
      Logger.getInstance().error('Could not postpone task', { error: err })
      setError(
        `Could not move it: ${err instanceof Error ? err.message : String(err)}`,
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !isBusy && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to another day</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="defer-until">Available again on</Label>
          <Input
            id="defer-until"
            type="date"
            min={earliest}
            value={until}
            aria-invalid={!isValid}
            onChange={(e) => setUntil(e.target.value)}
          />
          {!isValid && (
            <p className="text-sm text-destructive">
              Pick {earliest} or a later date.
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isBusy}
            onClick={onClose}
          >
            Back
          </Button>
          <Button
            type="button"
            disabled={isBusy || !isValid}
            onClick={() => void confirm()}
          >
            {isBusy && <Loader2 className="size-4 animate-spin" />}
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
