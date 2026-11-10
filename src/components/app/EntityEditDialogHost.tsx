import { useEntryDetail } from '@/workflows/hooks'
import {
  useEntityFields,
  useEntitySubmission,
} from '@/lib/entityActions/useEntityForm'
import { useMemo } from 'react'
import { useStore } from '@/store'
import { EditingEntity } from '@/store/slices/createUISlice'
import { EntityFormDialog } from '@/components/ui/custom/entityForms'
import {
  entityRegistry,
  getEntityTitle,
  toFormValues,
} from '@/lib/entityActions'

/**
 * The app-wide edit dialog. Mounted once; opened from anywhere through
 * `useStore.getState().openEditor(kind, id)`.
 */
export const EntityEditDialogHost = () => {
  const editing = useStore((state) => state.editing)

  if (!editing) {
    return null
  }
  // Remount per item so fetched data and errors don't leak between items.
  return (
    <EntityEditDialog key={`${editing.kind}:${editing.id}`} editing={editing} />
  )
}

const EntityEditDialog = ({ editing }: { editing: EditingEntity }) => {
  const closeEditor = useStore((state) => state.closeEditor)

  const entry = entityRegistry[editing.kind]
  const detail = useEntryDetail(editing.kind, editing.id)
  const item = detail.data
  const fields = useEntityFields(editing.kind)
  const submission = useEntitySubmission(editing.kind, closeEditor, editing.id)

  // Captured once per item so store updates don't reset the form mid-edit.
  const initialValues = useMemo(
    () => (item ? toFormValues(item, fields, entry.formDefaults) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item?.id, entry],
  )

  return (
    <EntityFormDialog<Record<string, unknown>>
      // Remount once loaded so the form re-seeds from `initialValues`.
      key={initialValues ? 'ready' : 'loading'}
      open
      onOpenChange={(open) => {
        if (!open && !submission.isSubmitting) {
          closeEditor()
        }
      }}
      title={item ? `Edit ${getEntityTitle(item)}` : `Edit ${entry.label}`}
      fields={fields}
      initialValues={initialValues ?? {}}
      onSubmit={submission.submit}
      submitLabel="Save changes"
      isSubmitting={submission.isSubmitting || !initialValues}
      errorMessage={
        submission.errorMessage ??
        (detail.error ? `Could not load this ${entry.label}.` : undefined)
      }
    />
  )
}
