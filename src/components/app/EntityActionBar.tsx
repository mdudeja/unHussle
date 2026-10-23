import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
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
import { EntityAction } from '@/lib/entityActions'
import { cn } from '@/lib/utils'
import { Logger } from '@c/Logger'

type EntityActionBarProps<T> = {
  item: T
  actions: EntityAction<T>[]
  /** Shown on the left, e.g. the selected item's title. */
  title?: string
  /** Renders a close button, e.g. to clear the selection. */
  onClose?: () => void
  className?: string
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/** A row of buttons for the actions that apply to `item`. */
export function EntityActionBar<T>({
  item,
  actions,
  title,
  onClose,
  className,
}: EntityActionBarProps<T>) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<EntityAction<T> | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const visibleActions = actions.filter(
    (action) => !action.isVisible || action.isVisible(item),
  )

  // Returns whether the action succeeded.
  const run = async (
    action: EntityAction<T>,
    onError: (message: string) => void,
  ) => {
    setPendingId(action.id)
    setError(null)
    try {
      await action.run(item)
      return true
    } catch (err) {
      Logger.getInstance().error(`Action "${action.label}" failed: ${err}`)
      onError(`Could not ${action.label.toLowerCase()}: ${errorMessage(err)}`)
      return false
    } finally {
      setPendingId(null)
    }
  }

  const handleClick = (action: EntityAction<T>) => {
    if (action.confirm) {
      setConfirmError(null)
      setConfirming(action)
      return
    }
    run(action, setError)
  }

  const handleConfirm = async () => {
    if (!confirming) {
      return
    }
    if (await run(confirming, setConfirmError)) {
      setConfirming(null)
    }
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-md border bg-primary/5 px-3 py-2',
        className,
      )}
    >
      {title && (
        <span className="mr-2 min-w-0 truncate font-medium" title={title}>
          {title}
        </span>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {visibleActions.map((action) => {
          const Icon = action.icon
          const isPending = pendingId === action.id
          return (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.variant ?? 'default'}
              disabled={pendingId !== null || action.isDisabled?.(item)}
              onClick={() => handleClick(action)}
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Icon className="size-4" />
              )}
              {action.label}
            </Button>
          )
        })}
      </div>
      {error && (
        <span className="text-sm text-destructive" role="alert">
          {error}
        </span>
      )}
      {onClose && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto size-8"
          onClick={onClose}
          title="Clear selection"
        >
          <X className="size-4" />
        </Button>
      )}

      <AlertDialog
        open={confirming !== null}
        onOpenChange={(open) => {
          if (!open && pendingId === null) {
            setConfirming(null)
          }
        }}
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
              <AlertDialogCancel disabled={pendingId !== null}>
                Back
              </AlertDialogCancel>
              <Button
                type="button"
                variant={
                  confirming.variant === 'destructive'
                    ? 'destructive'
                    : 'default'
                }
                disabled={pendingId !== null}
                onClick={handleConfirm}
              >
                {pendingId !== null && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {confirming.confirm.confirmLabel}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  )
}
