import {
  TaskRepository,
  ProjectRepository,
  AreaRepository,
  GoalRepository,
  TagRepository,
  TimeEntriesRepository,
  ResourceRepository,
  EntityUrlRepository,
} from '@/services/database/repositories'

export const dbService = {
  tasks: new TaskRepository(),
  projects: new ProjectRepository(),
  areas: new AreaRepository(),
  goals: new GoalRepository(),
  tags: new TagRepository(),
  entityUrls: new EntityUrlRepository(),
  timeEntries: new TimeEntriesRepository(),
  resources: new ResourceRepository(),
}
