import type { SupporterItems } from '@c/types/Hydrated'
import { makeJSONRequest } from '@/lib/server'
import { Url } from '@d/database/schemas'
import { DbService } from '@/services/database/DbService'

export class UrlsService extends DbService<Url> {
  private static instance: UrlsService

  constructor() {
    super('urls')
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new UrlsService()
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
