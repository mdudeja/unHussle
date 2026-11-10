import { Goal } from '@c/types/index'
import { DbService } from '@/services/database/DbService'

/** Provides goal-related data services for managing and accessing Goal records. */
export class GoalsService extends DbService<Goal> {
  private static instance: GoalsService

  /** Initializes the GoalsService for goal-related operations. */
  constructor() {
    super('goals')
  }

  /** Provides the shared instance of GoalsService. */
  static getInstance() {
    if (!this.instance) {
      this.instance = new GoalsService()
    }
    return this.instance
  }
}
