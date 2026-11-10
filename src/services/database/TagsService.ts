import { Tag } from '@c/types/index'
import { DbService } from '@/services/database/DbService'
import { makeJSONRequest } from '@/lib/server'
import type { ContainerDetail } from '@c/types/readModels'

export class TagsService extends DbService<Tag> {
  private static instance: TagsService
  constructor() {
    super('tags')
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new TagsService()
    }
    return this.instance
  }

  async fetchItems(id: string) {
    return makeJSONRequest<ContainerDetail>({
      url: `${this.dbUrl}/${this.baseEndpoint}/${id}/items`,
      method: 'GET',
    })
  }
}
