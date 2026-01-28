import { Area } from '@c/index'
import { DbService } from '@/services/DbService'

export class AreasService extends DbService<Area> {
  private static instance: AreasService

  constructor() {
    super('areas')
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new AreasService()
    }
    return this.instance
  }
}
