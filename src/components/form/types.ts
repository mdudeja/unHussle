import type { LucideIcon } from 'lucide-react'

export type FieldType =
  'text' | 'textarea' | 'number' | 'select' | 'date' | 'boolean'

export interface FieldOption {
  label: string
  value: string
}

/**
 * Describes a single field of an entity form. The `name` is constrained to the
 * keys of the entity type `T`, so a config can never reference a field that the
 * entity does not have.
 */
export interface FieldConfig<T extends object> {
  /** Property of `T` this field reads from / writes to. */
  name: Extract<keyof T, string>
  /** Human readable label rendered above the control. */
  label: string
  type: FieldType
  placeholder?: string
  /** Helper text rendered under the control. */
  description?: string
  /** Optional leading icon for the label. */
  icon?: LucideIcon
  required?: boolean
  disabled?: boolean
  /** For `select` fields: render an explicit "None" option. */
  allowEmpty?: boolean
  /** Options for `select` fields. */
  options?: FieldOption[]
  /** Grid column span (of a two column grid). Defaults to 1. */
  colSpan?: 1 | 2
  /** Constraint for `number` fields. */
  min?: number
  max?: number
  step?: number
  noSpacesAllowed?: boolean
}

export type FormValues<T extends object> = Partial<T>
