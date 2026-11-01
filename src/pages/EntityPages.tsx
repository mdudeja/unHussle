import {
  FileText,
  FolderKanban,
  GitGraph,
  Goal as GoalIcon,
  Hash,
  ListTodo,
  Tags,
} from 'lucide-react'
import {
  EntityListPage,
  EntityListPageConfig,
} from '@/components/pages/EntityListPage'
import { RelatedEntityTable } from '@/components/app'
import { useResourceActions, useTaskActions } from '@/lib/entityActions'
import { useRelatedTasks, useTaggedItems } from '@/lib/hooks/useRelatedItems'
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
import { Priority, ProgressStatus } from '@c/types/index'
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

const statusFilter = {
  columnId: 'status',
  label: 'Status',
  options: enumFilterOptions(ProgressStatus),
}

const priorityFilter = {
  columnId: 'priority',
  label: 'Priority',
  options: enumFilterOptions(Priority),
}

const updatedAtColumn = <TData extends { updated_at: number }>() =>
  dateColumn<TData>('updated_at', 'Updated', (row) => row.updated_at)

const projectsConfig: EntityListPageConfig<HydratedProject> = {
  kind: 'projects',
  title: 'Projects',
  selectSlice: (state) => state.projects,
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
    entityRefColumn('areas', 'Area', (row) => row.area_id),
    entityRefColumn('goals', 'Goal', (row) => row.goal_id),
    dateColumn('due_date', 'Due', (row) => row.due_date),
    hashtagColumn((row) => row.tags),
    updatedAtColumn(),
  ],
  filters: [statusFilter, priorityFilter],
  hiddenColumns: ['updated_at'],
}

const areasConfig: EntityListPageConfig<HydratedArea> = {
  kind: 'areas',
  title: 'Areas',
  selectSlice: (state) => state.areas,
  related: {
    label: 'tasks',
    icon: ListTodo,
    render: (item) => <RelatedTasks key={item.id} kind="areas" id={item.id} />,
  },
  columns: [
    titleColumn(GitGraph),
    priorityColumn(),
    hashtagColumn((row) => row.tags),
    updatedAtColumn(),
  ],
  filters: [priorityFilter],
  hiddenColumns: ['updated_at'],
}

const goalsConfig: EntityListPageConfig<HydratedGoal> = {
  kind: 'goals',
  title: 'Goals',
  selectSlice: (state) => state.goals,
  related: {
    label: 'tasks',
    icon: ListTodo,
    render: (item) => <RelatedTasks key={item.id} kind="goals" id={item.id} />,
  },
  columns: [
    titleColumn(GoalIcon),
    statusColumn(),
    priorityColumn(),
    entityRefColumn('areas', 'Area', (row) => row.area_id),
    dateColumn('due_date', 'Due', (row) => row.due_date),
    hashtagColumn((row) => row.tags),
    updatedAtColumn(),
  ],
  filters: [statusFilter, priorityFilter],
  hiddenColumns: ['updated_at'],
}

const tasksConfig: EntityListPageConfig<HydratedTask> = {
  kind: 'tasks',
  title: 'Tasks',
  selectSlice: (state) => state.tasks,
  useActions: useTaskActions,
  columns: [
    textColumn('title', 'Title', (row) => row.title),
    statusColumn(),
    priorityColumn(),
    entityRefColumn('projects', 'Project', (row) => row.project_id),
    entityRefColumn('areas', 'Area', (row) => row.area_id),
    entityRefColumn('goals', 'Goal', (row) => row.goal_id),
    ...taskFlagColumns<Task['Read']>(),
    dateColumn('due_date', 'Due', (row) => row.due_date),
    dateTimeColumn('scheduled_start', 'Start', (row) => row.scheduled_start),
    dateTimeColumn('scheduled_end', 'End', (row) => row.scheduled_end),
    updatedAtColumn(),
  ],
  filters: [statusFilter, priorityFilter, ...taskFlagFilters],
  hiddenColumns: [...hiddenTaskFlagColumns, 'updated_at'],
}

const urlsConfig: EntityListPageConfig<Url['Read']> = {
  kind: 'urls',
  title: 'URLs',
  selectSlice: (state) => state.urls,
  columns: [
    textColumn('title', 'Title', (row) => row.title),
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
  selectSlice: (state) => state.resources,
  useActions: useResourceActions,
  columns: [
    titleColumn(FileText),
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
  selectSlice: (state) => state.tags,
  related: {
    label: 'items',
    icon: Tags,
    render: (item) => <TaggedItems key={item.id} id={item.id} />,
  },
  columns: [
    titleColumn(Hash),
    textColumn('description', 'Description', (row) => row.description),
    updatedAtColumn(),
  ],
  hiddenColumns: ['updated_at'],
}

const RelatedTasks = ({
  kind,
  id,
}: {
  kind: 'areas' | 'projects' | 'goals'
  id: string
}) => {
  const { data, isLoading } = useRelatedTasks(kind, id)
  return (
    <RelatedEntityTable
      title="Tasks"
      kind="tasks"
      data={data ?? []}
      columns={tasksConfig.columns}
      filters={tasksConfig.filters}
      hiddenColumns={tasksConfig.hiddenColumns}
      isLoading={isLoading}
    />
  )
}

const TaggedItems = ({ id }: { id: string }) => {
  const { data, isLoading } = useTaggedItems(id)
  if (!data) {
    return isLoading ? null : (
      <p className="text-sm text-muted-foreground">Could not load items.</p>
    )
  }
  const tables = [
    data.tasks.length > 0 && (
      <RelatedEntityTable
        key="tasks"
        title="Tasks"
        kind="tasks"
        data={data.tasks}
        columns={tasksConfig.columns}
        filters={tasksConfig.filters}
        hiddenColumns={tasksConfig.hiddenColumns}
      />
    ),
    data.projects.length > 0 && (
      <RelatedEntityTable
        key="projects"
        title="Projects"
        kind="projects"
        data={data.projects}
        columns={projectsConfig.columns}
        filters={projectsConfig.filters}
      />
    ),
    data.areas.length > 0 && (
      <RelatedEntityTable
        key="areas"
        title="Areas"
        kind="areas"
        data={data.areas}
        columns={areasConfig.columns}
        filters={areasConfig.filters}
      />
    ),
    data.goals.length > 0 && (
      <RelatedEntityTable
        key="goals"
        title="Goals"
        kind="goals"
        data={data.goals}
        columns={goalsConfig.columns}
        filters={goalsConfig.filters}
      />
    ),
  ].filter(Boolean)
  return tables.length > 0 ? (
    <div className="space-y-6">{tables}</div>
  ) : (
    <p className="text-sm text-muted-foreground">No linked items.</p>
  )
}

export const ProjectsPage = () => <EntityListPage config={projectsConfig} />
export const AreasPage = () => <EntityListPage config={areasConfig} />
export const GoalsPage = () => <EntityListPage config={goalsConfig} />
export const TasksPage = () => <EntityListPage config={tasksConfig} />
export const UrlsPage = () => <EntityListPage config={urlsConfig} />
export const TagsPage = () => <EntityListPage config={tagsConfig} />
export const ResourcesPage = () => <EntityListPage config={resourcesConfig} />
