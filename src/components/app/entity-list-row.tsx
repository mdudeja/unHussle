import type { LucideIcon } from 'lucide-react'
import type { Priority, ProgressStatus } from '@c/types/enums'
import {
  EntityIcon,
  StatusPriorityIcons,
} from '@/components/ui/custom/list/fields'
import { ActionListItem } from '@/components/app/action-list-item'
import { EntityAction, EntityKind, getEntityTitle } from '@/lib/entityActions'
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
  ...props
}: EntityListRowProps<T>) {
  return (
    <ActionListItem
      {...props}
      item={item}
      title={getEntityTitle(item)}
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
    />
  )
}
