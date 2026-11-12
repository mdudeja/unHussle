import type { LucideIcon } from 'lucide-react'
import type { EntityRouteKey } from '@/lib/entityRoutes'

export type EntityKind = EntityRouteKey

/**
 * Something the user can do with an item. Actions are plain objects so any
 * renderer (the list page action bar, a menu, a card) can show them.
 * `run` throws on failure; renderers surface the error.
 */
export type EntityAction<T> = {
  id: string
  label: string
  icon: LucideIcon
  run: (item: T) => void | Promise<void>
  isVisible?: (item: T) => boolean
  isDisabled?: (item: T) => boolean
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  /** Ask before running, e.g. for destructive actions. */
  confirm?: {
    title: string
    description: (item: T) => string
    confirmLabel: string
  }
}

/** An action run on several selected items at once. */
export type BulkAction<T> = EntityAction<T[]>

export const visibleActions = <T>(actions: EntityAction<T>[], item: T) =>
  actions.filter((action) => !action.isVisible || action.isVisible(item))
