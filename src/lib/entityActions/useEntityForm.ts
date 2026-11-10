import { useMemo, useState, useRef } from 'react'
import { Logger } from '@c/Logger'
import { commandHeadForKind, type EntryRecord } from '@c/workflows/contracts'
import { useEntityReferences } from '@/lib/hooks/useEntityReferences'
import { useWorkflowRuntime } from '@/workflows/hooks'
import { entityRegistry } from './registry'
import type { EntityKind } from './types'

/** Creation and editing share the same field builders and mounted selector queries. */
export function useEntityFields(kind: EntityKind, enabled = true) {
  const { data: projectData } = useEntityReferences(
    'projects',
    enabled && kind === 'tasks',
  )
  const { data: areaData } = useEntityReferences(
    'areas',
    enabled && ['tasks', 'projects', 'goals'].includes(kind),
  )
  const { data: goalData } = useEntityReferences(
    'goals',
    enabled && ['tasks', 'projects'].includes(kind),
  )
  const entry = entityRegistry[kind]
  return useMemo(
    () =>
      entry.createFields({
        projects: { data: projectData },
        areas: { data: areaData },
        goals: { data: goalData },
      }),
    [entry, projectData, areaData, goalData],
  )
}

/** One submission/error implementation for both modes; a failed save preserves the draft. */
export function useEntitySubmission(
  kind: EntityKind,
  onSaved: (result: EntryRecord) => void,
  id?: string,
) {
  const runtime = useWorkflowRuntime()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()
  const entry = entityRegistry[kind]
  const pending = useRef(false)
  /** Creates or updates the current entry from the submitted form values, preventing duplicate submissions and reporting save errors. */
  const submit = async (values: Record<string, unknown>) => {
    if (pending.current) return
    pending.current = true
    setIsSubmitting(true)
    setErrorMessage(undefined)
    try {
      values = entry.transformValues?.(values) ?? values
      const head = commandHeadForKind[kind]
      const result = id
        ? await runtime.commands.execute(`${head}.change`, {
            kind,
            action: 'update',
            id,
            changes: values,
          })
        : await runtime.commands.execute(`${head}.add`, {
            kind,
            action: 'create',
            changes: values,
          })
      if (!result)
        throw new Error(`The ${entry.label} could not be loaded after saving`)
      onSaved(result)
    } catch (error) {
      Logger.getInstance().error(
        `Failed to ${id ? 'update' : 'create'} ${entry.label}`,
        { error },
      )
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : `Could not save the ${entry.label}. Please check the details and try again.`,
      )
    } finally {
      pending.current = false
      setIsSubmitting(false)
    }
  }
  return { submit, isSubmitting, errorMessage }
}
