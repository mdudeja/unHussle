import { Priority, ProgressStatus } from '@c/types/enums'
import type { FieldOption, FieldConfig } from './types'

/** Determines whether a value is blank, such as null, undefined, an empty or whitespace-only string, or an empty array. */
export const isBlank = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '') ||
  (Array.isArray(value) && value.length === 0)

/** Turns an enum value like `in_progress` into `In Progress`. */
export const humanizeEnumValue = (value: string): string =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())

export const statusOptions: FieldOption[] = Object.values(ProgressStatus).map(
  (value) => ({
    label: humanizeEnumValue(value),
    value,
  }),
)

export const priorityOptions: FieldOption[] = Object.values(Priority).map(
  (value) => ({
    label: humanizeEnumValue(value),
    value,
  }),
)

/** Submit only configured, direct editable fields. Hidden values explicitly clear stale columns. */
export function submittedFormValues<T extends object>(
  values: Partial<T>,
  fields: FieldConfig<T>[],
): Partial<T> {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      field.visibleWhen && !field.visibleWhen(values)
        ? null
        : values[field.name],
    ]),
  ) as Partial<T>
}
