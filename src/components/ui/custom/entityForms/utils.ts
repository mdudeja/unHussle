import { Priority, ProgressStatus } from '@c/types/enums'
import type { FieldOption } from './types'

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
