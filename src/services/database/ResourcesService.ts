import { Resource } from '@c/index'
import { DbService } from '@/services/database/DbService'

export class ResourcesService extends DbService<Resource> {
  private static instance: ResourcesService

  constructor() {
    super('resources')
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new ResourcesService()
    }
    return this.instance
  }
}
