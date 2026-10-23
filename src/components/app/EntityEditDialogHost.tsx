import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/store'
import { EntityFormDialog } from '@/components/ui/custom/entityForms'
import {
  entityRegistry,
  getEntityTitle,
  toFormValues,
} from '@/lib/entityActions'
import { Logger } from '@c/Logger'

type Item = { id: string } & Record<string, unknown>

/**
 * The app-wide edit dialog. Mounted once; opened from anywhere through
 * `useStore.getState().openEditor(kind, id)`.
 */
export const EntityEditDialogHost = () => {
  const editing = useStore((state) => state.editing)
  const closeEditor = useStore((state) => state.closeEditor)
  const projects = useStore((state) => state.projects)
  const areas = useStore((state) => state.areas)
  const goals = useStore((state) => state.goals)

  const entry = editing ? entityRegistry[editing.kind] : null
  const storeItem = useStore((state) =>
    editing && entry ? entry.selectSlice(state).getById(editing.id) : null,
  ) as Item | null

  // Items outside the loaded page (e.g. search results) aren't in the store.
  const [fetchedItem, setFetchedItem] = useState<Item | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  useEffect(() => {
    setFetchedItem(null)
    setErrorMessage(undefined)
    if (!editing || !entry || storeItem) {
      return
    }
    let isCurrent = true
    entry.service
      .fetchById(editing.id)
      .then((item) => {
        if (isCurrent) {
          setFetchedItem(item as Item)
        }
      })
      .catch((error) => {
        Logger.getInstance().error(
          `Failed to load ${entry.label} ${editing.id}: ${error}`,
        )
        if (isCurrent) {
          setErrorMessage(`Could not load this ${entry.label}.`)
        }
      })
    return () => {
      isCurrent = false
    }
    // Only refetch when a different item is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.kind, editing?.id])

  const item = storeItem ?? fetchedItem

  const fields = useMemo(
    () => entry?.createFields({ projects, areas, goals }) ?? [],
    [entry, projects, areas, goals],
  )

  // Captured once per item so store updates don't reset the form mid-edit.
  const initialValues = useMemo(
    () =>
      item && entry ? toFormValues(item, fields, entry.formDefaults) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item?.id, entry],
  )

  if (!editing || !entry) {
    return null
  }

  const handleSubmit = async (values: Record<string, unknown>) => {
    setIsSubmitting(true)
    setErrorMessage(undefined)
    try {
      await entry.selectSlice(useStore.getState()).update(editing.id, values)
      // Newly created tags should show up in the tag list and pickers
      if (Array.isArray(values.tags) && values.tags.length) {
        useStore
          .getState()
          .tags.fetch()
          .catch(() => {})
      }
      closeEditor()
    } catch (error) {
      Logger.getInstance().error(
        `Failed to update ${entry.label} ${editing.id}: ${error}`,
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
      // Remount per item so the form re-seeds from `initialValues`.
      key={`${editing.kind}:${editing.id}:${initialValues ? 'ready' : 'loading'}`}
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
      submitLabel="Save changes"
      isSubmitting={isSubmitting || !initialValues}
      errorMessage={errorMessage}
    />
  )
}
