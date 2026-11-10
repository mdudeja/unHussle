import { Area } from '@c/types/index'
import { DbService } from '@/services/database/DbService'

/** Service responsible for managing Area records and providing area-related operations. */
export class AreasService extends DbService<Area> {
  private static instance: AreasService

  /** Initializes the service for handling area-related operations. */
  constructor() {
    super('areas')
  }

  /** Provides access to the single shared instance of the areas service. */
  static getInstance() {
    if (!this.instance) {
      this.instance = new AreasService()
    }
    return this.instance
  }
}
