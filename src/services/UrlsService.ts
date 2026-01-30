import { Url } from '@d/database/schemas'
import { DbService } from '@/services/DbService'

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
}
