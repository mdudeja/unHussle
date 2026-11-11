import type { DomainQueries } from '@c/extensions/sdk'
import type { UnHussleDB } from '@d/database/UnHussleDB'
import {
  TasksRepository,
  ProjectsRepository,
  GoalsRepository,
  AreasRepository,
  ResourcesRepository,
  TagsRepository,
  UrlsRepository,
  TimeEntriesRepository,
} from '@d/database/repositories'
import { ReadModelsRepository } from '@d/database/repositories/readModels'
import { getTaskContext } from '@d/database/repositories/taskContext'

export function extensionQueries(database: UnHussleDB): DomainQueries {
  const repositories = {
    tasks: new TasksRepository(database),
    projects: new ProjectsRepository(database),
    goals: new GoalsRepository(database),
    areas: new AreasRepository(database),
    resources: new ResourcesRepository(database),
    tags: new TagsRepository(database),
    urls: new UrlsRepository(database),
    time_entries: new TimeEntriesRepository(database),
  }
  const reads = new ReadModelsRepository(database)
  return {
    list: (kind, page = 1, limit = 20) =>
      repositories[kind].getPaginated(
        Math.max(0, page - 1),
        Math.max(1, Math.min(limit, 100)),
      ),
    get: (kind, id) => repositories[kind].getById(id),
    references: (kind, options) => reads.references(kind, options),
    container: (kind, id, options) => reads.detail(kind, id, options),
    taskContext: async (id) => getTaskContext(await database.getDb(), id),
  }
}
