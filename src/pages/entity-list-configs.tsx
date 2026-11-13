import {
  FileText,
  FolderKanban,
  GitGraph,
  Goal as GoalIcon,
  Hash,
  Link,
  ListTodo,
} from 'lucide-react'
import { Priority, ProgressStatus } from '@c/types/enums'
import type { Url } from '@d/database/schemas/urls.schema'
import type { Tag } from '@d/database/schemas/tags.schema'
import type {
  HydratedArea,
  HydratedGoal,
  HydratedProject,
  HydratedResource,
  HydratedTask,
} from '@c/types/Hydrated'
import type { EntityListConfig } from '@/components/app/entity-list'
import type { ListFilter, ListSort, ListSortOption } from '@/lib/list-view'
import { useResourceActions, useTaskActions } from '@/lib/entityActions'
import {
  DateMeta,
  EntityRefs,
  enumFilterOptions,
  TaskFlags,
  taskFlagFilterOptions,
  SpentTimeMeta,
} from '@/components/ui/custom/list/fields'
import { parseTaskFlagFilter, TASK_FLAG_FILTER_ID } from '@/lib/task-flags'
import { getStatusIcon } from '@/components/ui/custom/StatusView'
import { getPriorityIcon } from '@/components/ui/custom/PriorityView'
import TagsView from '@/components/ui/custom/TagsView'
import UrlView from '@/components/ui/custom/UrlView'
import { useCompleteAction } from '@/lib/entityActions/useCompleteAction'

type WithStatus = { status?: ProgressStatus | null }
type WithPriority = { priority?: Priority | null }
type WithDue = { due_date?: number | null }
type Common = { title?: string | null; updated_at?: number | null }

const statusOrder = Object.values(ProgressStatus)
const priorityOrder = Object.values(Priority)

const statusFilter: ListFilter<WithStatus> = {
  id: 'status',
  label: 'Status',
  options: enumFilterOptions(ProgressStatus, getStatusIcon),
  matches: (row, selected) => String(row.status) === selected,
}

const priorityFilter: ListFilter<WithPriority> = {
  id: 'priority',
  label: 'Priority',
  options: enumFilterOptions(Priority, getPriorityIcon),
  matches: (row, selected) => String(row.priority) === selected,
}

// An unknown value (e.g. from an old link) filters nothing out.
const taskFlagFilter: ListFilter<HydratedTask> = {
  id: TASK_FLAG_FILTER_ID,
  label: 'Flags',
  options: taskFlagFilterOptions,
  matches: (row, selected) => {
    const flag = parseTaskFlagFilter(selected)
    return !flag || Boolean(row[flag.id]) === flag.isSet
  },
}

// Sort options, in the order they are offered.
const titleSort: ListSortOption<Common> = {
  id: 'title',
  label: 'Title',
  value: (row) => row.title,
}
const statusSort: ListSortOption<WithStatus> = {
  id: 'status',
  label: 'Status',
  value: (row) => (row.status ? statusOrder.indexOf(row.status) : undefined),
}
const prioritySort: ListSortOption<WithPriority> = {
  id: 'priority',
  label: 'Priority',
  value: (row) =>
    row.priority ? priorityOrder.indexOf(row.priority) : undefined,
}
const dueSort: ListSortOption<WithDue> = {
  id: 'due_date',
  label: 'Due date',
  value: (row) => row.due_date,
}
const updatedSort: ListSortOption<Common> = {
  id: 'updated_at',
  label: 'Last updated',
  value: (row) => row.updated_at,
}

const initialSort: ListSort = { sort: 'updated_at', desc: true }

export const projectsList: EntityListConfig<HydratedProject> = {
  kind: 'projects',
  title: 'Projects',
  icon: FolderKanban,
  useActions: () => useCompleteAction('projects'),
  renderMeta: (row) => (
    <>
      <EntityRefs
        refs={[
          row.area && { ...row.area, kind: 'areas' },
          row.goal && { ...row.goal, kind: 'goals' },
        ]}
      />
      {row.status === ProgressStatus.COMPLETED ? (
        <>
          <DateMeta label="Completed" millis={row.completed_at} />
          <SpentTimeMeta millis={row.spent_minutes} />
        </>
      ) : (
        <>
          <DateMeta label="Due" millis={row.due_date} />
        </>
      )}
      {row.tags && <TagsView tags={row.tags} />}
    </>
  ),
  filters: [statusFilter, priorityFilter],
  sorts: [titleSort, statusSort, prioritySort, dueSort, updatedSort],
  initialSort,
}

export const areasList: EntityListConfig<HydratedArea> = {
  kind: 'areas',
  title: 'Areas',
  icon: GitGraph,
  renderMeta: (row) => row.tags && <TagsView tags={row.tags} />,
  filters: [priorityFilter],
  sorts: [titleSort, prioritySort, updatedSort],
  initialSort,
}

export const goalsList: EntityListConfig<HydratedGoal> = {
  kind: 'goals',
  title: 'Goals',
  icon: GoalIcon,
  useActions: () => useCompleteAction('goals'),
  renderMeta: (row) => (
    <>
      <EntityRefs refs={[row.area && { ...row.area, kind: 'areas' }]} />
      {row.status === ProgressStatus.COMPLETED ? (
        <>
          <DateMeta label="Completed" millis={row.completed_at} />
          <SpentTimeMeta millis={row.spent_minutes} />
        </>
      ) : (
        <>
          <DateMeta label="Due" millis={row.due_date} />
        </>
      )}
      {row.tags && <TagsView tags={row.tags} />}
    </>
  ),
  filters: [statusFilter, priorityFilter],
  sorts: [titleSort, statusSort, prioritySort, dueSort, updatedSort],
  initialSort,
}

export const tasksList: EntityListConfig<HydratedTask> = {
  kind: 'tasks',
  title: 'Tasks',
  icon: ListTodo,
  useActions: useTaskActions,
  primaryActionIds: ['start', 'pause'],
  renderMeta: (row) => (
    <>
      <EntityRefs
        refs={[
          row.project && { ...row.project, kind: 'projects' },
          row.area && { ...row.area, kind: 'areas' },
          row.goal && { ...row.goal, kind: 'goals' },
        ]}
      />
      <TaskFlags task={row} />
      {row.status === ProgressStatus.COMPLETED ? (
        <>
          <DateMeta label="Completed" millis={row.completed_at} />
          <SpentTimeMeta millis={row.spent_minutes} />
        </>
      ) : (
        <>
          <DateMeta label="Due" millis={row.due_date} />
          <DateMeta label="Starts" millis={row.scheduled_start} withTime />
        </>
      )}
    </>
  ),
  filters: [statusFilter, priorityFilter, taskFlagFilter],
  sorts: [
    titleSort,
    statusSort,
    prioritySort,
    dueSort,
    {
      id: 'scheduled_start',
      label: 'Start time',
      value: (row) => row.scheduled_start,
    },
    updatedSort,
  ],
  initialSort,
}

export const urlsList: EntityListConfig<Url['Read']> = {
  kind: 'urls',
  title: 'URLs',
  icon: Link,
  renderMeta: (row) => (
    <>
      <UrlView url={row.url} />
      {row.description && (
        <span className="line-clamp-1">{row.description}</span>
      )}
    </>
  ),
  filters: [],
  sorts: [
    titleSort,
    { id: 'url', label: 'Address', value: (row) => row.url },
    updatedSort,
  ],
  initialSort,
}

export const resourcesList: EntityListConfig<HydratedResource> = {
  kind: 'resources',
  title: 'Resources',
  icon: FileText,
  useActions: useResourceActions,
  renderMeta: (row) => (
    <>
      {row.missing && (
        <span className="text-destructive">Missing from vault</span>
      )}
      {row.links && row.links.length > 0 && (
        <span className="line-clamp-1">
          Linked to {row.links.map((link) => link.title).join(', ')}
        </span>
      )}
      {row.tags && <TagsView tags={row.tags} />}
    </>
  ),
  filters: [],
  sorts: [titleSort, updatedSort],
  initialSort,
}

export const tagsList: EntityListConfig<Tag['Read']> = {
  kind: 'tags',
  title: 'Tags',
  icon: Hash,
  renderMeta: (row) =>
    row.description && <span className="line-clamp-1">{row.description}</span>,
  filters: [],
  sorts: [titleSort, updatedSort],
  initialSort,
}
