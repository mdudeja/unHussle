import { ListItem } from '@/components/ui/custom/list/list-item'
import { ActionControls } from '@/components/app/action-controls'
import type { EntityAction } from '@/lib/entityActions'
import { useRunAction } from '@/lib/entityActions/use-run-action'

type ActionListItemProps<T> = Omit<
  React.ComponentProps<typeof ListItem>,
  'actions' | 'error'
> & {
  item: T
  actions: EntityAction<T>[]
  /** Visible ones are shown on the row; the rest go in the menu. */
  primaryActionIds?: string[]
}

/** A list row that runs `actions` on `item` and shows their errors inline. */
export function ActionListItem<T>({
  item,
  actions,
  primaryActionIds,
  ...props
}: ActionListItemProps<T>) {
  const runner = useRunAction(item)
  return (
    <ListItem
      {...props}
      error={runner.error}
      actions={
        !props.selection && (
          <ActionControls
            runner={runner}
            actions={actions}
            buttonIds={primaryActionIds}
            title={props.title}
          />
        )
      }
    />
  )
}
