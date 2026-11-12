import { ClipboardList, Smile, Zap } from 'lucide-react'

export const taskFlags = [
  { id: 'is_fun', slug: 'fun', label: 'Fun', icon: Smile },
  { id: 'is_quick', slug: 'quick', label: 'Quick', icon: Zap },
  { id: 'is_chore', slug: 'chore', label: 'Chore', icon: ClipboardList },
] as const

export type TaskFlagId = (typeof taskFlags)[number]['id']

export type TaskFlagsRecord = Record<TaskFlagId, boolean>

// One filter covers every flag. Its values read like the options:
// `quick` for quick tasks, `not-quick` for the rest.
export const TASK_FLAG_FILTER_ID = 'flag'
const NOT_PREFIX = 'not-'

export const taskFlagFilterValues = taskFlags.flatMap((flag) => [
  { flag, value: flag.slug, label: flag.label },
  {
    flag,
    value: `${NOT_PREFIX}${flag.slug}`,
    label: `Not ${flag.label.toLowerCase()}`,
  },
])

/** The flag and wanted state for a filter value, or undefined if unknown. */
export const parseTaskFlagFilter = (value: string) => {
  const isSet = !value.startsWith(NOT_PREFIX)
  const slug = isSet ? value : value.slice(NOT_PREFIX.length)
  const flag = taskFlags.find((candidate) => candidate.slug === slug)
  return flag && { id: flag.id, isSet }
}
