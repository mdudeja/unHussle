import { Resource } from '@c/types/index'
import { DbService } from '@/services/database/DbService'

/** Service for managing and accessing resource records. */
export class ResourcesService extends DbService<Resource> {
  private static instance: ResourcesService

  /** Initializes a new instance of the resources service. */
  constructor() {
    super('resources')
  }

  /** Retrieves the shared ResourcesService instance, creating it on first access if necessary. */
  static getInstance() {
    if (!this.instance) {
      this.instance = new ResourcesService()
    }
    return this.instance
  }
}
