import { Task, TaskWithTagsAndUrls } from '@/types'
import { BaseWithSupportersRepository } from './BaseWithSupportersRepository'

export class TaskRepository extends BaseWithSupportersRepository<
  Task,
  TaskWithTagsAndUrls
> {
  protected tableName = 'tasks'
  protected tagsJunctionTable = 'junction_tags'
  protected urlsJunctionTable = 'junction_urls'
}
