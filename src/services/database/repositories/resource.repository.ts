import { Resource, ResourceWithTagsAndUrls } from '@/types'
import { BaseWithSupportersRepository } from './BaseWithSupportersRepository'

export class ResourceRepository extends BaseWithSupportersRepository<
  Resource,
  ResourceWithTagsAndUrls
> {
  protected tableName = 'resources'
  protected tagsJunctionTable = 'tags'
  protected urlsJunctionTable = 'entity_urls'
}
