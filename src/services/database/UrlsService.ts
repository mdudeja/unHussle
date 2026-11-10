import type { ContainerDetail } from '@c/types/readModels'
import { makeJSONRequest } from '@/lib/server'
import { Url } from '@d/database/schemas'
import { DbService } from '@/services/database/DbService'

/** Provides access to and management of URL records and their associated container items. */
export class UrlsService extends DbService<Url> {
  private static instance: UrlsService

  /** Initializes the URLs service. */
  constructor() {
    super('urls')
  }

  /** Provides access to the shared UrlsService instance. */
  static getInstance() {
    if (!this.instance) {
      this.instance = new UrlsService()
    }
    return this.instance
  }
  /** Fetches the items associated with the specified container ID. */
  async fetchItems(id: string) {
    return makeJSONRequest<ContainerDetail>({
      url: `${this.dbUrl}/${this.baseEndpoint}/${id}/items`,
      method: 'GET',
    })
  }
}
