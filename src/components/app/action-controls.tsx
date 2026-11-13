import { Loader2, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ActionConfirmDialog } from '@/components/app/action-confirm-dialog'
import { EntityAction, visibleActions } from '@/lib/entityActions'
import type { ActionRunner } from '@/lib/entityActions/use-run-action'

type ActionControlsProps<T> = {
  runner: ActionRunner<T>
  actions: EntityAction<T>[]
  /** Visible ones are shown as buttons, in this order; the rest go in the menu. */
  buttonIds?: string[]
  /** The first button's style; the others are outlined. */
  primaryVariant?: 'default' | 'outline'
  size?: 'sm' | 'default'
  /** Names the item in the menu button's label. */
  title: string
}

/** Buttons for an item's main actions and a menu for the rest. */
export function ActionControls<T>({
  runner,
  actions,
  buttonIds = [],
  primaryVariant = 'outline',
  size = 'sm',
  title,
}: ActionControlsProps<T>) {
  const { item, pendingId } = runner
  const visible = visibleActions(actions, item)
  const buttons = buttonIds.flatMap((id) => {
    const action = visible.find((candidate) => candidate.id === id)
    return action ? [action] : []
  })
  const menuActions = visible.filter((action) => !buttons.includes(action))
  const isBusy = pendingId !== null
  const isMenuPending = isBusy && !buttons.some(({ id }) => id === pendingId)

  return (
    <>
      {buttons.map((action, index) => (
        <Button
          key={action.id}
          type="button"
          size={size}
          variant={index === 0 ? primaryVariant : 'outline'}
          disabled={isBusy || action.isDisabled?.(item)}
          onClick={() => runner.trigger(action)}
        >
          {pendingId === action.id ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <action.icon className="size-4" />
          )}
          {action.label}
        </Button>
      ))}
      {menuActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size={size === 'sm' ? 'icon-sm' : 'icon'}
                disabled={isBusy}
                aria-label={`More actions for ${title}`}
              />
            }
          >
            {isMenuPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreHorizontal className="size-4" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto">
            {menuActions.map((action) => (
              <DropdownMenuItem
                key={action.id}
                variant={
                  action.variant === 'destructive' ? 'destructive' : 'default'
                }
                disabled={action.isDisabled?.(item)}
                onClick={() => runner.trigger(action)}
              >
                <action.icon />
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ActionConfirmDialog runner={runner} />
    </>
  )
}
