import { Pencil, Trash2 } from 'lucide-react'
import { useStore } from '@/store'
import { entityRegistry, getEntityTitle } from './registry'
import type { EntityAction, EntityKind } from './types'

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
