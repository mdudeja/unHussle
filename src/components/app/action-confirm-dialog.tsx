import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ActionRunner } from '@/lib/entityActions/use-run-action'

/** Asks before running the runner's pending action. */
export function ActionConfirmDialog<T>({
  runner,
}: {
  runner: ActionRunner<T>
}) {
  const { item, confirming, confirmError, pendingId } = runner
  const isPending = pendingId !== null
  return (
    <AlertDialog
      open={confirming !== null}
      onOpenChange={(open) => !open && runner.cancelConfirm()}
    >
      {confirming?.confirm && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming.confirm.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirming.confirm.description(item)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmError && (
            <p className="text-sm text-destructive" role="alert">
              {confirmError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Back</AlertDialogCancel>
            <Button
              type="button"
              variant={
                confirming.variant === 'destructive' ? 'destructive' : 'default'
              }
              disabled={isPending}
              onClick={runner.confirm}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {confirming.confirm.confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
