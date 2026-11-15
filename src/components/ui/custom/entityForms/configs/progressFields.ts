import { Gauge, Ruler, TrendingUp } from 'lucide-react'
import { countProgressError, PROGRESS_UNIT_MAX_LENGTH } from '@c/progress'
import { ProgressInput } from '@c/types/enums'
import type { CountProgress } from '@c/progress'
import type { FieldConfig } from '../types'

const counts = (values: Partial<CountProgress>) => values.progress_total != null

const progressInputOptions = [
  { label: 'Where I got to, like a page', value: ProgressInput.POSITION },
  { label: 'How much I did, like pages read', value: ProgressInput.AMOUNT },
]

/** Count progress fields shared by projects and goals. */
export const createCountProgressFields = <
  T extends Partial<CountProgress>,
>(): FieldConfig<T>[] =>
  (
    [
      {
        name: 'progress_total',
        label: 'Count progress up to',
        type: 'number',
        min: 1,
        step: 1,
        placeholder: 'No count',
        description: 'For example 350 pages. Leave empty to not count.',
        icon: Gauge,
      },
      {
        name: 'progress_unit',
        label: 'Unit',
        type: 'text',
        required: true,
        placeholder: 'pages',
        icon: Ruler,
        visibleWhen: counts,
        validate: (value) =>
          String(value).length > PROGRESS_UNIT_MAX_LENGTH
            ? `Use up to ${PROGRESS_UNIT_MAX_LENGTH} characters`
            : undefined,
      },
      {
        name: 'progress_input',
        label: 'Record',
        type: 'select',
        required: true,
        options: progressInputOptions,
        icon: TrendingUp,
        visibleWhen: counts,
      },
      {
        name: 'progress_done',
        label: 'Done so far',
        type: 'number',
        min: 0,
        step: 1,
        placeholder: '0',
        icon: TrendingUp,
        visibleWhen: counts,
        validate: (value, values) =>
          countProgressError({
            progress_done: Number(value),
            progress_total: values.progress_total ?? null,
            progress_unit: values.progress_unit ?? 'unit',
            progress_input: values.progress_input ?? ProgressInput.AMOUNT,
          }) ?? undefined,
      },
    ] satisfies FieldConfig<Partial<CountProgress>>[]
  ) as FieldConfig<T>[]

/**
 * Hidden count fields are submitted as `null`: an item without a total has
 * done nothing, and a hidden goal percentage keeps its stored value.
 */
export const resolveCountProgress = (values: Record<string, unknown>) => {
  const { progress, ...rest } = values
  return {
    ...rest,
    ...(progress == null ? {} : { progress }),
    progress_done: values.progress_done ?? 0,
  }
}
