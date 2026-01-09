import { Task, TaskWithTagsAndUrls } from '@/types'
import { BaseWithSupportersRepository } from './BaseWithSupportersRepository'

export class TaskRepository extends BaseWithSupportersRepository<
  Task,
  TaskWithTagsAndUrls
> {
  protected tableName = 'tasks'
  protected tagsJunctionTable = 'tags'
  protected urlsJunctionTable = 'entity_urls'
}
