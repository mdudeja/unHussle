import { useEntryDetail, useEntryList } from '@/workflows/hooks'
import { useMemo, useState } from 'react'
import { useStore } from '@/store'
import { EditingEntity } from '@/store/slices/createUISlice'
import { EntityFormDialog } from '@/components/ui/custom/entityForms'
import {
  entityRegistry,
  getEntityTitle,
  toFormValues,
} from '@/lib/entityActions'
import { Logger } from '@c/Logger'

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
  const projects = useStore((state) => state.projects)
  const areas = useStore((state) => state.areas)
  const goals = useStore((state) => state.goals)

  useEntryList('projects', 1, editing.kind === 'tasks')
  useEntryList(
    'areas',
    1,
    ['tasks', 'projects', 'goals'].includes(editing.kind),
  )
  useEntryList('goals', 1, ['tasks', 'projects'].includes(editing.kind))

  const entry = entityRegistry[editing.kind]
  const detail = useEntryDetail(editing.kind, editing.id)
  const item = detail.data
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const fields = useMemo(
    () => entry.createFields({ projects, areas, goals }),
    [entry, projects, areas, goals],
  )

  // Captured once per item so store updates don't reset the form mid-edit.
  const initialValues = useMemo(
    () => (item ? toFormValues(item, fields, entry.formDefaults) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item?.id, entry],
  )

  const handleSubmit = async (values: Record<string, unknown>) => {
    setIsSubmitting(true)
    setErrorMessage(undefined)
    try {
      await entry.selectSlice(useStore.getState()).update(editing.id, values)
      closeEditor()
    } catch (error) {
      Logger.getInstance().error(
        `Failed to update ${entry.label} ${editing.id}`,
        { error },
      )
      setErrorMessage(
        `Could not save the ${entry.label}. Please check the details and try again.`,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <EntityFormDialog<Record<string, unknown>>
      // Remount once loaded so the form re-seeds from `initialValues`.
      key={initialValues ? 'ready' : 'loading'}
      open
      onOpenChange={(open) => {
        if (!open && !isSubmitting) {
          closeEditor()
        }
      }}
      title={item ? `Edit ${getEntityTitle(item)}` : `Edit ${entry.label}`}
      fields={fields}
      initialValues={initialValues ?? {}}
      onSubmit={handleSubmit}
      transformValues={entry.transformValues}
      submitLabel="Save changes"
      isSubmitting={isSubmitting || !initialValues}
      errorMessage={
        errorMessage ??
        (detail.error ? `Could not load this ${entry.label}.` : undefined)
      }
    />
  )
}
