import { Loader2, MoreHorizontal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Priority, ProgressStatus } from '@c/types/enums'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ListItem } from '@/components/ui/custom/list/list-item'
import {
  EntityIcon,
  StatusPriorityIcons,
} from '@/components/ui/custom/list/fields'
import { ActionConfirmDialog } from '@/components/app/action-confirm-dialog'
import {
  EntityAction,
  EntityKind,
  getEntityTitle,
  visibleActions,
} from '@/lib/entityActions'
import { useRunAction } from '@/lib/entityActions/use-run-action'
import { getEntityItemRoute } from '@/lib/entityRoutes'

export type EntityRow = {
  id: string
  icon?: string | null
  color?: string | null
  status?: ProgressStatus | null
  priority?: Priority | null
}

type EntityListRowProps<T extends EntityRow> = {
  kind: EntityKind
  item: T
  fallbackIcon: LucideIcon
  meta?: React.ReactNode
  actions: EntityAction<T>[]
  /** The first visible one is shown on the row; the rest go in the menu. */
  primaryActionIds?: string[]
  selection?: { isSelected: boolean; onToggle: () => void }
}

export function EntityListRow<T extends EntityRow>({
  kind,
  item,
  fallbackIcon,
  meta,
  actions,
  primaryActionIds = [],
  selection,
}: EntityListRowProps<T>) {
  const runner = useRunAction(item)
  const title = getEntityTitle(item)
  const visible = visibleActions(actions, item)
  const primary = visible.find((action) => primaryActionIds.includes(action.id))
  const menuActions = visible.filter((action) => action !== primary)
  const isBusy = runner.pendingId !== null

  return (
    <ListItem
      title={title}
      href={getEntityItemRoute(kind, item.id)}
      media={
        <EntityIcon
          icon={item.icon}
          color={item.color}
          fallback={fallbackIcon}
        />
      }
      indicators={
        <StatusPriorityIcons status={item.status} priority={item.priority} />
      }
      meta={meta}
      error={runner.error}
      selection={selection}
      actions={
        !selection && (
          <>
            {primary && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isBusy || primary.isDisabled?.(item)}
                onClick={() => runner.trigger(primary)}
              >
                {runner.pendingId === primary.id ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <primary.icon className="size-4" />
                )}
                {primary.label}
              </Button>
            )}
            {menuActions.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={isBusy}
                      aria-label={`More actions for ${title}`}
                    />
                  }
                >
                  {isBusy && runner.pendingId !== primary?.id ? (
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
                        action.variant === 'destructive'
                          ? 'destructive'
                          : 'default'
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
    />
  )
}
