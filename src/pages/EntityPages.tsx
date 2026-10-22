import { FolderKanban, GitGraph, Goal as GoalIcon, Hash } from 'lucide-react'
import {
  EntityListPage,
  EntityListPageConfig,
} from '@/components/pages/EntityListPage'
import {
  dateColumn,
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
} from '@/components/ui/custom/table/columns'
import { Priority, ProgressStatus } from '@c/types/index'
import { Task } from '@d/database/schemas/tasks.schema'
import { Url } from '@d/database/schemas/urls.schema'
import { Tag } from '@d/database/schemas/tags.schema'
import {
  HydratedArea,
  HydratedGoal,
  HydratedProject,
  HydratedTask,
} from '@d/database/repositories'

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
  title: 'Projects',
  selectSlice: (state) => state.projects,
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
}

const areasConfig: EntityListPageConfig<HydratedArea> = {
  title: 'Areas',
  selectSlice: (state) => state.areas,
  columns: [
    titleColumn(GitGraph),
    statusColumn(),
    priorityColumn(),
    hashtagColumn((row) => row.tags),
    updatedAtColumn(),
  ],
  filters: [statusFilter, priorityFilter],
}

const goalsConfig: EntityListPageConfig<HydratedGoal> = {
  title: 'Goals',
  selectSlice: (state) => state.goals,
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
}

const tasksConfig: EntityListPageConfig<HydratedTask> = {
  title: 'Tasks',
  selectSlice: (state) => state.tasks,
  columns: [
    textColumn('title', 'Title', (row) => row.title),
    statusColumn(),
    priorityColumn(),
    entityRefColumn('projects', 'Project', (row) => row.project_id),
    entityRefColumn('areas', 'Area', (row) => row.area_id),
    entityRefColumn('goals', 'Goal', (row) => row.goal_id),
    ...taskFlagColumns<Task['Read']>(),
    dateColumn('due_date', 'Due', (row) => row.due_date),
    updatedAtColumn(),
  ],
  filters: [statusFilter, priorityFilter, ...taskFlagFilters],
  hiddenColumns: hiddenTaskFlagColumns,
}

const urlsConfig: EntityListPageConfig<Url['Read']> = {
  title: 'URLs',
  selectSlice: (state) => state.urls,
  columns: [
    textColumn('title', 'Title', (row) => row.title),
    textColumn('url', 'URL', (row) => row.url),
    textColumn('hostname', 'Host', (row) => row.parts?.hostname),
    updatedAtColumn(),
  ],
}

const tagsConfig: EntityListPageConfig<Tag['Read']> = {
  title: 'Tags',
  selectSlice: (state) => state.tags,
  columns: [
    titleColumn(Hash),
    textColumn('description', 'Description', (row) => row.description),
    updatedAtColumn(),
  ],
}

export const ProjectsPage = () => <EntityListPage config={projectsConfig} />
export const AreasPage = () => <EntityListPage config={areasConfig} />
export const GoalsPage = () => <EntityListPage config={goalsConfig} />
export const TasksPage = () => <EntityListPage config={tasksConfig} />
export const UrlsPage = () => <EntityListPage config={urlsConfig} />
export const TagsPage = () => <EntityListPage config={tagsConfig} />
