import { Tag } from '@c/types/index'
import { DbService } from '@/services/database/DbService'
import { makeJSONRequest } from '@/lib/server'
import type { ContainerDetail } from '@c/types/readModels'

/** Provides access to tag-related resources and operations. */
export class TagsService extends DbService<Tag> {
  private static instance: TagsService
  /** Initializes the service for interacting with tag-related resources. */
  constructor() {
    super('tags')
  }

  /** Provides the shared TagsService instance. */
  static getInstance() {
    if (!this.instance) {
      this.instance = new TagsService()
    }
    return this.instance
  }

  /** Fetches the items belonging to a container. */
  async fetchItems(id: string) {
    return makeJSONRequest<ContainerDetail>({
      url: `${this.dbUrl}/${this.baseEndpoint}/${id}/items`,
      method: 'GET',
    })
  }
}
