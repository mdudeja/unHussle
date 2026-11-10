import type { EntityReference } from '@c/types/readModels'
import { Column, ColumnDef } from '@tanstack/react-table'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ClipboardList,
  Smile,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconResolver } from '@/components/ui/utils/IconResolver'
import { DataTableFilterOption } from '@/components/ui/custom/table/DataTable'
import { Priority, ProgressStatus } from '@c/types/enums'
import { Tag } from '@c/types/index'
import {
  formatMillisAsDdMmYyyy,
  formatMillisAsDdMmYyyyHhMm,
} from '@c/datetimeUtils'
import IconBadge from '@/components/ui/custom/IconBadge'
import StatusView from '@/components/ui/custom/StatusView'
import { toLabel } from '@/components/ui/utils/misc'
import PriorityView from '@/components/ui/custom/PriorityView'
import EntityRefBadge, {
  EntityRefKind,
} from '@/components/ui/custom/EntityRefBadge'
import TagsView from '@/components/ui/custom/TagsView'
import UrlView from '@/components/ui/custom/UrlView'

export const enumFilterOptions = (
  values: Record<string, string>,
): DataTableFilterOption[] =>
  Object.values(values).map((value) => ({ label: toLabel(value), value }))

export const booleanFilterOptions: DataTableFilterOption[] = [
  { label: 'Yes', value: 'true' },
  { label: 'No', value: 'false' },
]

export function SortableHeader<TData>({
  column,
  title,
}: {
  column: Column<TData, unknown>
  title: string
}) {
  const sorted = column.getIsSorted()
  const SortIcon =
    sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-3 h-8"
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      {title}
      <SortIcon className="h-3.5 w-3.5 text-muted-foreground" />
    </Button>
  )
}

// Plain sortable text column.
export const textColumn = <TData,>(
  id: string,
  title: string,
  accessor: (row: TData) => string | null | undefined,
): ColumnDef<TData, unknown> => ({
  id,
  accessorFn: (row) => accessor(row) ?? '',
  header: ({ column }) => <SortableHeader column={column} title={title} />,
  cell: ({ getValue }) => (
    <span className="line-clamp-1 max-w-md">{getValue<string>()}</span>
  ),
})

export const urlColumn = <TData,>(
  id: string,
  title: string,
  accessor: (row: TData) => string | null | undefined,
): ColumnDef<TData, unknown> => ({
  id,
  accessorFn: (row) => accessor(row) ?? '',
  header: ({ column }) => <SortableHeader column={column} title={title} />,
  cell: ({ getValue }) => {
    const url = getValue<string>()
    return url ? <UrlView url={url} key={`${id}-${url}`} /> : null
  },
})

// Hashtag stored without `#` (e.g. `health_fitness`), shown as `#health_fitness`.
export const hashtagColumn = <TData,>(
  accessor: (row: TData) => Tag['Read'][] | null | undefined,
): ColumnDef<TData, unknown> => ({
  id: 'hashtag',
  accessorFn: (row) => accessor(row) ?? undefined,
  header: ({ column }) => <SortableHeader column={column} title="Tags" />,
  cell: ({ getValue }) => {
    const tags = getValue<Tag['Read'][]>()
    return tags ? <TagsView tags={tags} /> : null
  },
})

// Title with the record's own icon/color, falling back to a default icon.
export const titleColumn = <
  TData extends { title: string; icon?: string | null; color?: string | null },
>(
  fallbackIcon: LucideIcon,
): ColumnDef<TData, unknown> => ({
  id: 'title',
  accessorFn: (row) => row.title,
  header: ({ column }) => <SortableHeader column={column} title="Title" />,
  cell: ({ row }) => {
    const { icon, color, title } = row.original
    const FallbackIcon = fallbackIcon
    return (
      <div className="flex items-center gap-2 font-medium">
        {icon ? (
          <IconResolver
            icon={icon}
            color={color ?? undefined}
            className="h-4 w-4 shrink-0"
          />
        ) : (
          <FallbackIcon
            className="h-4 w-4 shrink-0"
            color={color ?? undefined}
          />
        )}
        <span className="line-clamp-1">{title}</span>
      </div>
    )
  },
})

const statusOrder = Object.values(ProgressStatus)

export const statusColumn = <
  TData extends { status?: ProgressStatus | null },
>(): ColumnDef<TData, unknown> => ({
  id: 'status',
  accessorFn: (row) => row.status ?? undefined,
  header: ({ column }) => <SortableHeader column={column} title="Status" />,
  sortingFn: (a, b) =>
    statusOrder.indexOf(a.original.status as ProgressStatus) -
    statusOrder.indexOf(b.original.status as ProgressStatus),
  cell: ({ row }) =>
    row.original.status ? <StatusView status={row.original.status} /> : null,
})

const priorityOrder = Object.values(Priority)

export const priorityColumn = <
  TData extends { priority?: Priority | null },
>(): ColumnDef<TData, unknown> => ({
  id: 'priority',
  accessorFn: (row) => row.priority ?? undefined,
  header: ({ column }) => <SortableHeader column={column} title="Priority" />,
  sortingFn: (a, b) =>
    priorityOrder.indexOf(a.original.priority as Priority) -
    priorityOrder.indexOf(b.original.priority as Priority),
  cell: ({ row }) =>
    row.original.priority ? (
      <PriorityView priority={row.original.priority} />
    ) : null,
})

// Epoch-millis column rendered as DD/MM/YYYY; empty values sort last.
export const dateColumn = <TData,>(
  id: string,
  title: string,
  accessor: (row: TData) => number | null | undefined,
): ColumnDef<TData, unknown> => ({
  id,
  accessorFn: (row) => accessor(row) ?? undefined,
  header: ({ column }) => <SortableHeader column={column} title={title} />,
  sortUndefined: 'last',
  cell: ({ getValue }) => {
    const millis = getValue<number | undefined>()
    return millis !== undefined ? formatMillisAsDdMmYyyy(millis) : null
  },
})

// Like `dateColumn`, but also shows the time of day.
export const dateTimeColumn = <TData,>(
  id: string,
  title: string,
  accessor: (row: TData) => number | null | undefined,
): ColumnDef<TData, unknown> => ({
  ...dateColumn(id, title, accessor),
  cell: ({ getValue }) => {
    const millis = getValue<number | undefined>()
    return millis !== undefined ? formatMillisAsDdMmYyyyHhMm(millis) : null
  },
})

// Link to a related project/area/goal. Filterable by id, not sortable.
export const entityRefColumn = <TData,>(
  kind: EntityRefKind,
  title: string,
  accessor: (row: TData) => EntityReference | null | undefined,
): ColumnDef<TData, unknown> => ({
  id: `${kind}_ref`,
  accessorFn: (row) => accessor(row) ?? undefined,
  header: title,
  enableSorting: false,
  cell: ({ getValue }) => {
    const record = getValue<EntityReference | undefined>()
    return record ? <EntityRefBadge kind={kind} record={record} /> : null
  },
})

const taskFlags = [
  { id: 'is_fun', label: 'Fun', icon: Smile },
  { id: 'is_chore', label: 'Chore', icon: ClipboardList },
  { id: 'is_quick', label: 'Quick', icon: Zap },
] as const

type TaskFlagsRecord = { is_fun: boolean; is_chore: boolean; is_quick: boolean }

// Combined display column plus one hidden column per flag for filtering.
export const taskFlagColumns = <TData extends TaskFlagsRecord>(): ColumnDef<
  TData,
  unknown
>[] => [
  {
    id: 'flags',
    header: 'Flags',
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex gap-1">
        {taskFlags
          .filter((flag) => row.original[flag.id])
          .map(({ id, label, icon: Icon }) => (
            <IconBadge
              key={id}
              variant="outline"
              icon={<Icon className="h-3 w-3" />}
            >
              {label}
            </IconBadge>
          ))}
      </div>
    ),
  },
  ...taskFlags.map((flag): ColumnDef<TData, unknown> => ({
    id: flag.id,
    accessorFn: (row) => row[flag.id],
    header: flag.label,
  })),
]

export const taskFlagFilters = taskFlags.map((flag) => ({
  columnId: flag.id,
  label: flag.label,
  options: booleanFilterOptions,
}))

export const hiddenTaskFlagColumns = taskFlags.map((flag) => flag.id)
