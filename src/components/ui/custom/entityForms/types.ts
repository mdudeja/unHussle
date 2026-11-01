import type { LucideIcon } from 'lucide-react'

export type FieldType =
  | 'taskAnchor'
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'color'
  | 'icon'
  | 'recurrance'
  | 'tags'
  | 'urls'

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
  /** no spaces allowed in the input value. Useful for tags, slugs, etc. */
  noSpacesAllowed?: boolean
  /**
   * Custom validation, run when the value is not blank. Return an error
   * message to block submission, or `undefined` when the value is valid.
   * `values` holds the whole form, for checks that span several fields.
   */
  validate?: (value: unknown, values: Partial<T>) => string | undefined
  /**
   * Only render the field when this returns true for the current form values.
   * Hidden fields are skipped during validation and submitted as `null`, so
   * only use this on fields whose column is nullable.
   */
  visibleWhen?: (values: Partial<T>) => boolean
}

export type FormValues<T extends object> = Partial<T>
