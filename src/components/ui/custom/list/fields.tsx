import type { EntityReference } from '@c/types/readModels'
import type { LucideIcon } from 'lucide-react'
import { Priority, ProgressStatus } from '@c/types/enums'
import {
  formatMillisAsDdMmYyyy,
  formatMillisAsDdMmYyyyHhMm,
  formatSpentTime,
} from '@c/datetimeUtils'
import type { ListFilterOption } from '@/lib/list-view'
import {
  taskFlagFilterValues,
  taskFlags,
  type TaskFlagsRecord,
} from '@/lib/task-flags'
import { IconResolver } from '@/components/ui/utils/IconResolver'
import { toLabel } from '@/components/ui/utils/misc'
import IconBadge from '@/components/ui/custom/IconBadge'
import { StatusIcon } from '@/components/ui/custom/StatusView'
import { PriorityIcon } from '@/components/ui/custom/PriorityView'
import EntityRefBadge from '@/components/ui/custom/EntityRefBadge'

export const enumFilterOptions = (
  values: Record<string, string>,
  icon?: (value: string) => React.ReactNode,
): ListFilterOption[] =>
  Object.values(values).map((value) => ({
    label: toLabel(value),
    value,
    icon: icon?.(value),
  }))

export const taskFlagFilterOptions: ListFilterOption[] =
  taskFlagFilterValues.map(({ flag: { icon: Icon }, value, label }) => ({
    value,
    label,
    icon: <Icon className="size-4" />,
  }))

/** The record's own icon and colour, or the kind's default icon. */
export function EntityIcon({
  icon,
  color,
  fallback: Fallback,
}: {
  icon?: string | null
  color?: string | null
  fallback: LucideIcon
}) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-muted-foreground/20 bg-background">
      {icon ? (
        <IconResolver
          icon={icon}
          color={color ?? undefined}
          className="size-4"
        />
      ) : (
        <Fallback className="size-4" color={color ?? undefined} />
      )}
    </span>
  )
}

function LabelledIcon({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <span title={label} className="flex items-center">
      {children}
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function StatusPriorityIcons({
  status,
  priority,
}: {
  status?: ProgressStatus | null
  priority?: Priority | null
}) {
  return (
    <>
      {status && (
        <LabelledIcon label={`Status: ${toLabel(status)}`}>
          <StatusIcon status={status} />
        </LabelledIcon>
      )}
      {priority && (
        <LabelledIcon label={`Priority: ${toLabel(priority)}`}>
          <PriorityIcon priority={priority} />
        </LabelledIcon>
      )}
    </>
  )
}

/** Epoch millis shown as DD/MM/YYYY, with the time when `withTime`. */
export function DateMeta({
  label,
  millis,
  withTime = false,
}: {
  label: string
  millis?: number | null
  withTime?: boolean
}) {
  if (millis === null || millis === undefined) {
    return null
  }
  return (
    <span>
      {label}{' '}
      {withTime
        ? formatMillisAsDdMmYyyyHhMm(millis)
        : formatMillisAsDdMmYyyy(millis)}
    </span>
  )
}

export function SpentTimeMeta({ millis: minutes }: { millis?: number | null }) {
  if (minutes === null || minutes === undefined) {
    return null
  }

  return <span>Spent {formatSpentTime(minutes)}</span>
}

export function EntityRefs({
  refs,
}: {
  refs: (EntityReference | null | undefined)[]
}) {
  return refs.map((ref) =>
    ref?.id && ref.kind ? (
      <EntityRefBadge key={ref.id} kind={ref.kind} record={ref} />
    ) : null,
  )
}

export function TaskFlags({ task }: { task: TaskFlagsRecord }) {
  return taskFlags
    .filter((flag) => task[flag.id])
    .map(({ id, label, icon: Icon }) => (
      <IconBadge key={id} variant="outline" icon={<Icon className="size-3" />}>
        {label}
      </IconBadge>
    ))
}
