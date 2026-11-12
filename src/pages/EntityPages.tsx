import {
  FileText,
  FolderKanban,
  GitGraph,
  Goal as GoalIcon,
  Hash,
  Link,
  ListTodo,
  Tags,
} from 'lucide-react'
import {
  EntityListPage,
  EntityListPageConfig,
} from '@/components/pages/EntityListPage'
import { RelatedEntityTable } from '@/components/app'
import { useResourceActions, useTaskActions } from '@/lib/entityActions'
import { useContainerDetail } from '@/lib/hooks/useRelatedItems'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { getEntityItemRoute } from '@/lib/entityRoutes'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/ui/custom/table/DataTable'
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
} from '@tanstack/react-table'
import type {
  ReadContainerKind,
  ContainerDetail,
  EntityReference,
} from '@c/types/readModels'
import {
  dateColumn,
  dateTimeColumn,
  entityRefColumn,
  enumFilterOptions,
  hashtagColumn,
  hiddenTaskFlagColumns,
  priorityColumn,
  statusColumn,
  taskFlagColumns,
  taskFlagFilters,
  textColumn,
  titleColumn,
  urlColumn,
} from '@/components/ui/custom/table/columns'
import { Priority, ProgressStatus } from '@c/types/enums'
import { Task } from '@d/database/schemas/tasks.schema'
import { Url } from '@d/database/schemas/urls.schema'
import { Tag } from '@d/database/schemas/tags.schema'
import {
  HydratedArea,
  HydratedGoal,
  HydratedProject,
  HydratedResource,
  HydratedTask,
} from '@c/types/Hydrated'
import { getStatusIcon } from '@/components/ui/custom/StatusView'
import { getPriorityIcon } from '@/components/ui/custom/PriorityView'

const statusFilter = {
  columnId: 'status',
  label: 'Status',
  options: enumFilterOptions(ProgressStatus, getStatusIcon),
}

const priorityFilter = {
  columnId: 'priority',
  label: 'Priority',
  options: enumFilterOptions(Priority, getPriorityIcon),
}

const updatedAtColumn = <TData extends { updated_at: number }>() =>
  dateColumn<TData>('updated_at', 'Updated', (row) => row.updated_at)

const projectsConfig: EntityListPageConfig<HydratedProject> = {
  kind: 'projects',
  title: 'Projects',
  related: {
    label: 'tasks',
    icon: ListTodo,
    render: (item) => (
      <RelatedTasks key={item.id} kind="projects" id={item.id} />
    ),
  },
  columns: [
    titleColumn(FolderKanban),
    statusColumn(),
    priorityColumn(),
    entityRefColumn(
      ['areas', 'goals'],
      'Collections',
      (row) =>
        [
          { ...row.area, kind: 'areas' },
          { ...row.goal, kind: 'goals' },
        ] as EntityReference[],
    ),
    dateColumn('due_date', 'Due', (row) => row.due_date),
    hashtagColumn((row) => row.tags),
    updatedAtColumn(),
  ],
  filters: [statusFilter, priorityFilter],
  hiddenColumns: ['updated_at', 'priority', 'status'],
}

const areasConfig: EntityListPageConfig<HydratedArea> = {
  kind: 'areas',
  title: 'Areas',
  related: {
    label: 'tasks',
    icon: ListTodo,
    render: (item) => <RelatedTasks key={item.id} kind="areas" id={item.id} />,
  },
  columns: [
    titleColumn(GitGraph, true, false),
    priorityColumn(),
    hashtagColumn((row) => row.tags),
    updatedAtColumn(),
  ],
  filters: [priorityFilter],
  hiddenColumns: ['updated_at', 'priority'],
}

const goalsConfig: EntityListPageConfig<HydratedGoal> = {
  kind: 'goals',
  title: 'Goals',
  related: {
    label: 'tasks',
    icon: ListTodo,
    render: (item) => <RelatedTasks key={item.id} kind="goals" id={item.id} />,
  },
  columns: [
    titleColumn(GoalIcon),
    statusColumn(),
    priorityColumn(),
    entityRefColumn(
      ['areas'],
      'Collections',
      (row) => [{ ...row.area, kind: 'areas' }] as EntityReference[],
    ),
    dateColumn('due_date', 'Due', (row) => row.due_date),
    hashtagColumn((row) => row.tags),
    updatedAtColumn(),
  ],
  filters: [statusFilter, priorityFilter],
  hiddenColumns: ['updated_at', 'priority', 'status'],
}

const tasksConfig: EntityListPageConfig<HydratedTask> = {
  kind: 'tasks',
  title: 'Tasks',
  useActions: useTaskActions,
  columns: [
    titleColumn(ListTodo),
    statusColumn(),
    priorityColumn(),
    entityRefColumn(
      ['projects', 'areas', 'goals'],
      'Collections',
      (row) =>
        [
          { ...row.project, kind: 'projects' },
          { ...row.area, kind: 'areas' },
          { ...row.goal, kind: 'goals' },
        ] as EntityReference[],
    ),
    ...taskFlagColumns<Task['Read']>(),
    dateColumn('due_date', 'Due', (row) => row.due_date),
    dateTimeColumn('scheduled_start', 'Start', (row) => row.scheduled_start),
    dateTimeColumn('scheduled_end', 'End', (row) => row.scheduled_end),
    updatedAtColumn(),
  ],
  filters: [statusFilter, priorityFilter, ...taskFlagFilters],
  hiddenColumns: [...hiddenTaskFlagColumns, 'updated_at', 'priority', 'status'],
}

const urlsConfig: EntityListPageConfig<Url['Read']> = {
  kind: 'urls',
  title: 'URLs',
  related: {
    label: 'items',
    icon: Tags,
    render: (item) => <SupporterItems key={item.id} kind="urls" id={item.id} />,
  },
  columns: [
    titleColumn(Link, false, false) as ColumnDef<Url['Read'], unknown>,
    urlColumn('url', 'URL', (row) => row.url),
    textColumn('description', 'Description', (row) => row.description),
    updatedAtColumn(),
  ],
  hiddenColumns: ['updated_at'],
}

const resourcesConfig: EntityListPageConfig<HydratedResource> = {
  kind: 'resources',
  title: 'Resources',
  description: 'Markdown notes in your vault, linked to tasks and collections.',
  useActions: useResourceActions,
  columns: [
    titleColumn(FileText, false, false),
    textColumn('links', 'Linked to', (row) =>
      row.links?.map((link) => link.title).join(', '),
    ),
    hashtagColumn((row) => row.tags),
    textColumn('missing', 'File', (row) =>
      row.missing ? 'Missing from vault' : '',
    ),
    textColumn('description', 'Description', (row) => row.description),
    updatedAtColumn(),
  ],
  hiddenColumns: ['description'],
}

const tagsConfig: EntityListPageConfig<Tag['Read']> = {
  kind: 'tags',
  title: 'Tags',
  related: {
    label: 'items',
    icon: Tags,
    render: (item) => <SupporterItems key={item.id} kind="tags" id={item.id} />,
  },
  columns: [
    titleColumn(Hash, false, false),
    textColumn('description', 'Description', (row) => row.description),
    updatedAtColumn(),
  ],
  hiddenColumns: ['updated_at'],
}

const RelatedTasks = ({
  kind,
  id,
}: {
  kind: ReadContainerKind
  id: string
}) => {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'updated_at', desc: true },
  ])
  const [filters, setFilters] = useState<ColumnFiltersState>([])
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const { data, isLoading, error, retry } = useContainerDetail(kind, id, {
    sort: sorting[0]?.id ?? 'id',
    direction: sorting[0]?.desc ? 'desc' : 'asc',
    ...Object.fromEntries(
      filters.map((filter) => [filter.id, String(filter.value)]),
    ),
    q,
    status: filters.find((filter) => filter.id === 'status')?.value as
      string | undefined,
    priority: filters.find((filter) => filter.id === 'priority')?.value as
      string | undefined,
    cursor: cursors[cursors.length - 1],
    limit: 20,
  })
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        Tasks ({data?.tasks.total ?? '…'})
      </h2>
      {error && (
        <p role="alert">
          Could not load tasks.{' '}
          <Button
            variant="ghost"
            onClick={() => {
              void retry().catch(() => {})
            }}
          >
            Retry
          </Button>
        </p>
      )}
      <DataTable
        columns={tasksConfig.columns}
        serverSorting={sorting}
        onServerSortingChange={(update) => {
          setSorting(typeof update === 'function' ? update(sorting) : update)
          setCursors([undefined])
        }}
        data={data?.tasks.items ?? []}
        filters={tasksConfig.filters}
        hiddenColumns={tasksConfig.hiddenColumns}
        searchValue={q}
        onSearchChange={(value) => {
          setQ(value)
          setCursors([undefined])
        }}
        columnFilters={filters}
        onColumnFiltersChange={(update) => {
          setFilters(typeof update === 'function' ? update(filters) : update)
          setCursors([undefined])
        }}
        manualRead
        isLoading={isLoading}
        onRowClick={(row) => navigate(getEntityItemRoute('tasks', row.id))}
      />
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          disabled={cursors.length === 1 || isLoading}
          onClick={() => setCursors((previous) => previous.slice(0, -1))}
        >
          Previous
        </Button>
        <span className="text-sm">Page {cursors.length}</span>
        <Button
          variant="outline"
          disabled={!data?.tasks.nextCursor || isLoading}
          onClick={() =>
            setCursors((previous) => [
              ...previous,
              data?.tasks.nextCursor ?? undefined,
            ])
          }
        >
          Next
        </Button>
      </div>
      {data && (kind === 'tags' || kind === 'urls') && (
        <DirectItems data={data} />
      )}
    </div>
  )
}

const DirectItems = ({
  data: { directRelations: data },
}: {
  data: ContainerDetail
}) => (
  <div className="space-y-6">
    {data.resources.length > 0 && (
      <RelatedEntityTable
        title="Resources"
        kind="resources"
        data={data.resources}
        columns={resourcesConfig.columns}
        hiddenColumns={resourcesConfig.hiddenColumns}
      />
    )}
    {data.projects.length > 0 && (
      <RelatedEntityTable
        title="Projects"
        kind="projects"
        data={data.projects}
        columns={projectsConfig.columns}
        filters={projectsConfig.filters}
      />
    )}
    {data.areas.length > 0 && (
      <RelatedEntityTable
        title="Areas"
        kind="areas"
        data={data.areas}
        columns={areasConfig.columns}
        filters={areasConfig.filters}
      />
    )}
    {data.goals.length > 0 && (
      <RelatedEntityTable
        title="Goals"
        kind="goals"
        data={data.goals}
        columns={goalsConfig.columns}
        filters={goalsConfig.filters}
      />
    )}
  </div>
)

const SupporterItems = RelatedTasks

export const ProjectsPage = () => <EntityListPage config={projectsConfig} />
export const AreasPage = () => <EntityListPage config={areasConfig} />
export const GoalsPage = () => <EntityListPage config={goalsConfig} />
export const TasksPage = () => <EntityListPage config={tasksConfig} />
export const UrlsPage = () => <EntityListPage config={urlsConfig} />
export const TagsPage = () => <EntityListPage config={tagsConfig} />
export const ResourcesPage = () => <EntityListPage config={resourcesConfig} />
