import { ProgressInput } from '@c/types/enums'

export const PROGRESS_UNIT_MAX_LENGTH = 20

/** The count fields of a project or goal; it counts once it has a total. */
export type CountProgress = {
  progress_done: number
  progress_total: number | null
  progress_unit: string | null
  progress_input: ProgressInput | null
}

const isProgressInput = (value: unknown): value is ProgressInput =>
  Object.values(ProgressInput).includes(value as ProgressInput)

/** Why the count fields don't fit together, or `null` when they do. */
export function countProgressError({
  progress_done: done,
  progress_total: total,
  progress_unit: unit,
  progress_input: input,
}: CountProgress): string | null {
  if (!Number.isInteger(done) || done < 0)
    return 'Progress must be a whole number of 0 or more'
  if (total === null)
    return done > 0 || unit !== null || input !== null
      ? 'Add a total to track progress, or clear the other progress fields'
      : null
  if (!Number.isInteger(total) || total < 1)
    return 'The total must be a whole number of 1 or more'
  if (!unit?.trim() || unit.length > PROGRESS_UNIT_MAX_LENGTH)
    return `Add a unit of up to ${PROGRESS_UNIT_MAX_LENGTH} characters, such as "pages"`
  if (!isProgressInput(input)) return 'Choose how progress is recorded'
  if (input === ProgressInput.POSITION && done > total)
    return `Progress can't pass the total of ${total} ${unit}`
  return null
}

/** The units recording `value` adds: a position adds what it moved on. */
export const addedUnits = (
  input: ProgressInput,
  done: number,
  value: number,
) => (input === ProgressInput.POSITION ? value - done : value)

/**
 * Progress after recording `value`: the position reached replaces it, an
 * amount adds to it.
 */
export const doneAfter = (input: ProgressInput, done: number, value: number) =>
  done + addedUnits(input, done, value)

/**
 * The value that records `added` units on an item: its new position, or the
 * amount itself.
 */
export const valueFor = (input: ProgressInput, done: number, added: number) =>
  input === ProgressInput.POSITION ? done + added : added
