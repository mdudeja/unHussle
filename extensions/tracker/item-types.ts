import { ProgressInput } from 'unhussle/frontend'

/** A kind of thing to track, such as a book, with its default count unit. */
export type ItemType = {
  id: string
  name: string
  unit: string
  input: ProgressInput
}

export const DEFAULT_TYPES: ItemType[] = [
  { id: 'book', name: 'Book', unit: 'pages', input: ProgressInput.POSITION },
  {
    id: 'course',
    name: 'Course',
    unit: 'modules',
    input: ProgressInput.POSITION,
  },
  {
    id: 'lectures',
    name: 'Lecture series',
    unit: 'lectures',
    input: ProgressInput.POSITION,
  },
]

const UNIT_MAX_LENGTH = 20

/** How progress is recorded, in the order the selects list it. */
export const INPUT_ITEMS = [
  { value: ProgressInput.POSITION, label: 'Where I got to' },
  { value: ProgressInput.AMOUNT, label: 'How much I did' },
]

/** A goal is a target to add up to; a project takes its type's default. */
export const defaultInput = (kind: 'projects' | 'goals', type: ItemType) =>
  kind === 'goals' ? ProgressInput.AMOUNT : type.input

const isItemType = (value: unknown): value is ItemType => {
  if (typeof value !== 'object' || value === null) return false
  const { id, name, unit, input } = value as Record<string, unknown>
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    typeof unit === 'string' &&
    Object.values(ProgressInput).includes(input as ProgressInput)
  )
}

/** The saved types; throws when the setting has another shape. */
export function parseTypes(value: unknown): ItemType[] {
  if (value === undefined) return DEFAULT_TYPES
  if (!Array.isArray(value) || !value.every(isItemType))
    throw new Error('The saved item types are not valid')
  return value
}

export type TypeErrors = {
  /** One message per type row, in order. */
  rows: (string | undefined)[]
  list?: string
}

export function typeErrors(types: ItemType[]): TypeErrors {
  const names = types.map((type) => type.name.trim().toLowerCase())
  return {
    list: types.length ? undefined : 'Add at least one type.',
    rows: types.map((type, index) =>
      !names[index]
        ? 'Enter a name.'
        : names.indexOf(names[index]) !== index
          ? 'Use a different name for each type.'
          : !type.unit.trim()
            ? 'Enter a unit, such as pages.'
            : type.unit.trim().length > UNIT_MAX_LENGTH
              ? `Use up to ${UNIT_MAX_LENGTH} characters for the unit.`
              : undefined,
    ),
  }
}

export const hasTypeErrors = (errors: TypeErrors) =>
  Boolean(errors.list || errors.rows.some(Boolean))
