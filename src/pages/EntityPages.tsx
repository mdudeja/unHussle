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
} from '@/components/table/columns'
import { Priority, ProgressStatus } from '@c/types/index'
import { Project } from '@d/database/schemas/projects.schema'
import { Area } from '@d/database/schemas/areas.schema'
import { Goal } from '@d/database/schemas/goals.schema'
import { Task } from '@d/database/schemas/tasks.schema'
import { Url } from '@d/database/schemas/urls.schema'
import { Tag } from '@d/database/schemas/tags.schema'

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

const projectsConfig: EntityListPageConfig<Project['Read']> = {
  title: 'Projects',
  selectSlice: (state) => state.projects,
  columns: [
    titleColumn(FolderKanban),
    hashtagColumn((row) => row.project_tag),
    statusColumn(),
    priorityColumn(),
    entityRefColumn('areas', 'Area', (row) => row.area_id),
    entityRefColumn('goals', 'Goal', (row) => row.goal_id),
    dateColumn('due_date', 'Due', (row) => row.due_date),
    updatedAtColumn(),
  ],
  filters: [statusFilter, priorityFilter],
}

const areasConfig: EntityListPageConfig<Area['Read']> = {
  title: 'Areas',
  selectSlice: (state) => state.areas,
  columns: [
    titleColumn(GitGraph),
    hashtagColumn((row) => row.area_tag),
    statusColumn(),
    priorityColumn(),
    updatedAtColumn(),
  ],
  filters: [statusFilter, priorityFilter],
}

const goalsConfig: EntityListPageConfig<Goal['Read']> = {
  title: 'Goals',
  selectSlice: (state) => state.goals,
  columns: [
    titleColumn(GoalIcon),
    hashtagColumn((row) => row.goal_tag),
    statusColumn(),
    priorityColumn(),
    entityRefColumn('areas', 'Area', (row) => row.area_id),
    dateColumn('due_date', 'Due', (row) => row.due_date),
    updatedAtColumn(),
  ],
  filters: [statusFilter, priorityFilter],
}

const tasksConfig: EntityListPageConfig<Task['Read']> = {
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
