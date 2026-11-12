import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EntityAction, visibleActions } from '@/lib/entityActions'
import { useRunAction } from '@/lib/entityActions/use-run-action'
import { ActionConfirmDialog } from '@/components/app/action-confirm-dialog'

/** A row of buttons for the actions that apply to `item`. */
export function EntityActionBar<T>({
  item,
  actions,
}: {
  item: T
  actions: EntityAction<T>[]
}) {
  const runner = useRunAction(item)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {visibleActions(actions, item).map((action) => {
          const Icon = action.icon
          return (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.variant ?? 'default'}
              disabled={runner.pendingId !== null || action.isDisabled?.(item)}
              onClick={() => runner.trigger(action)}
            >
              {runner.pendingId === action.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Icon className="size-4" />
              )}
              {action.label}
            </Button>
          )
        })}
      </div>
      {runner.error && (
        <p className="text-sm text-destructive" role="alert">
          {runner.error}
        </p>
      )}
      <ActionConfirmDialog runner={runner} />
    </div>
  )
}
