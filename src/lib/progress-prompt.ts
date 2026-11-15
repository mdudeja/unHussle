import type { RecordedProgressSession } from '@c/scheduler/contracts'
import { addedUnits, valueFor, type CountProgress } from '@c/progress'
import { ProgressInput } from '@c/types/enums'

export type CountingItem = CountProgress & {
  id: string
  title: string
  progress_total: number
  progress_unit: string
  progress_input: ProgressInput
}
export type PromptField = {
  session: RecordedProgressSession
  item: CountingItem
}

const sameUnit = (a: CountingItem, b: CountingItem) =>
  a.progress_unit.trim().toLowerCase() === b.progress_unit.trim().toLowerCase()

/**
 * One field per unit: a goal sharing its project's unit follows the
 * project's change instead of asking twice.
 */
export function promptFields(fields: PromptField[]) {
  const [lead, ...rest] = fields
  if (!lead) return { asked: [], following: [] }
  const following = rest.filter(({ item }) => sameUnit(item, lead.item))
  return {
    asked: [lead, ...rest.filter((field) => !following.includes(field))],
    following,
  }
}

/** The value each session records, given the values entered for the asked fields. */
export function promptValues(
  fields: PromptField[],
  entered: Record<string, number>,
) {
  const { asked, following } = promptFields(fields)
  const values = asked.map(({ session }) => ({
    sessionId: session.id,
    value: entered[session.id],
  }))
  const [lead] = asked
  if (!lead) return values
  const { progress_input, progress_done } = lead.item
  const added = addedUnits(progress_input, progress_done, entered[lead.session.id])
  return [
    ...values,
    ...following.map(({ session, item }) => ({
      sessionId: session.id,
      value: valueFor(item.progress_input, item.progress_done, added),
    })),
  ]
}

/** Why an entered value can't be saved, or `null`. */
export function promptValueError(item: CountingItem, raw: string) {
  const value = Number(raw)
  if (raw.trim() === '' || !Number.isInteger(value) || value < 0)
    return 'Enter a whole number of 0 or more'
  if (
    item.progress_input === ProgressInput.POSITION &&
    value > item.progress_total
  )
    return `Enter ${item.progress_total} or less`
  return null
}

/** Narrows a project or goal read to one that counts progress. */
export const isCounting = (
  item: Partial<CountProgress> & { id: string; title: string },
): item is CountingItem =>
  item.progress_total != null &&
  item.progress_unit != null &&
  item.progress_input != null &&
  typeof item.progress_done === 'number'
