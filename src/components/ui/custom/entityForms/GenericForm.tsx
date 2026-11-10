import React, { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FieldConfig } from './types'
import { isBlank, submittedFormValues } from './utils'
import { FormField } from './FormField'

export interface GenericFormProps<T extends object> {
  fields: FieldConfig<T>[]
  /** Initial values used to seed the form. Resets whenever the form remounts. */
  initialValues?: Partial<T>
  onSubmit: (values: Partial<T>) => void | Promise<void>
  /** Derives/normalizes values after validation, right before `onSubmit`. */
  transformValues?: (values: Partial<T>) => Partial<T>
  onCancel?: () => void
  submitLabel?: string
  cancelLabel?: string
  isSubmitting?: boolean
  /** Renders the values read-only (all controls disabled, submit hidden). */
  readOnly?: boolean
  /** Optional error surfaced above the footer (e.g. from a failed submit). */
  errorMessage?: string
  className?: string
}

/**
 * A schema driven form. It renders a control for every entry in `fields` and
 * returns the collected values through `onSubmit`. Because `FieldConfig` is
 * constrained to the keys of `T`, the form stays fully type-safe for any entity.
 */
export function GenericForm<T extends object>({
  fields,
  initialValues,
  onSubmit,
  transformValues,
  onCancel,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
  isSubmitting = false,
  readOnly = false,
  errorMessage,
  className,
}: GenericFormProps<T>) {
  const formId = useId()
  const [values, setValues] = useState<Partial<T>>(initialValues ?? {})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const setValue = (name: Extract<keyof T, string>, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  const visibleFields = fields.filter(
    (field) => !field.visibleWhen || field.visibleWhen(values),
  )

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {}
    for (const field of visibleFields) {
      if (field.required && isBlank(values[field.name])) {
        nextErrors[field.name] = `${field.label} is required`
      }

      if (
        field.noSpacesAllowed &&
        values[field.name] &&
        typeof values[field.name] === 'string'
      ) {
        if ((values[field.name] as string).includes(' ')) {
          nextErrors[field.name] = `${field.label} cannot contain spaces`
        }
      }

      if (
        field.validate &&
        !nextErrors[field.name] &&
        !isBlank(values[field.name])
      ) {
        const message = field.validate(values[field.name], values)
        if (message) nextErrors[field.name] = message
      }
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (readOnly || isSubmitting) return
    if (!validate()) return
    const finalValues = submittedFormValues(values, fields)
    await onSubmit(transformValues ? transformValues(finalValues) : finalValues)
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className={cn('space-y-4', className)}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {visibleFields.map((field) => (
          <FormField
            key={field.name}
            field={field}
            fieldId={`${formId}-${field.name}`}
            value={values[field.name]}
            error={errors[field.name]}
            disabled={readOnly || field.disabled}
            onChange={(value) => setValue(field.name, value)}
          />
        ))}
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </Button>
        )}
        {!readOnly && (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {submitLabel}
          </Button>
        )}
      </div>
    </form>
  )
}
