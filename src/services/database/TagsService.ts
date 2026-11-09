import { Tag } from '@c/types/index'
import { DbService } from '@/services/database/DbService'
import { makeJSONRequest } from '@/lib/server'
import type { SupporterItems } from '@c/types/Hydrated'

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
    return makeJSONRequest<SupporterItems>({
      url: `${this.dbUrl}/${this.baseEndpoint}/${id}/items`,
      method: 'GET',
    })
  }
}
