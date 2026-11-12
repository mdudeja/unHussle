import { Pencil, Trash2 } from 'lucide-react'
import { useStore } from '@/store'
import { entityRegistry, getEntityTitle } from './registry'
import type { BulkAction, EntityAction, EntityKind } from './types'

/** Edit and Delete, available for every entity kind. */
export const useCommonActions = <T extends { id: string }>(
  kind: EntityKind,
  { onDeleted }: { onDeleted?: (item: T) => void } = {},
): EntityAction<T>[] => {
  const { label } = entityRegistry[kind]
  return [
    {
      id: 'edit',
      label: 'Edit',
      icon: Pencil,
      variant: 'outline',
      run: (item) => useStore.getState().openEditor(kind, item.id),
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      run: async (item) => {
        await entityRegistry[kind]
          .selectSlice(useStore.getState())
          .remove(item.id)
        onDeleted?.(item)
      },
      confirm: {
        title: `Delete this ${label}?`,
        description: (item) =>
          `"${getEntityTitle(item)}" will be permanently deleted.`,
        confirmLabel: 'Delete',
      },
    },
  ]
}

const countLabel = (count: number, label: string) =>
  `${count} ${label}${count === 1 ? '' : 's'}`

/** Bulk Delete, available for every entity kind. */
export const useCommonBulkActions = <T extends { id: string }>(
  kind: EntityKind,
): BulkAction<T>[] => {
  const { label } = entityRegistry[kind]
  return [
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      variant: 'destructive',
      // One at a time, so a failure reports how many were already deleted.
      run: async (items) => {
        const slice = entityRegistry[kind].selectSlice(useStore.getState())
        for (const [index, item] of items.entries()) {
          try {
            await slice.remove(item.id)
          } catch (error) {
            throw new Error(
              `deleted ${index} of ${items.length}. ${getEntityTitle(item)}: ${
                error instanceof Error ? error.message : String(error)
              }`,
              { cause: error },
            )
          }
        }
      },
      isDisabled: (items) => items.length === 0,
      confirm: {
        title: `Delete these ${label}s?`,
        description: (items) =>
          `${countLabel(items.length, label)} will be permanently deleted.`,
        confirmLabel: 'Delete',
      },
    },
  ]
}
