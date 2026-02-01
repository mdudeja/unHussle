import { Goal } from '@c/index'
import { DbService } from '@/services/database/DbService'

export class GoalsService extends DbService<Goal> {
  private static instance: GoalsService

  constructor() {
    super('goals')
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new GoalsService()
    }
    return this.instance
  }
}
