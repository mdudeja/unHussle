import { Tag } from '@c/index'
import { DbService } from '@/services/DbService'

export class EntityTagsService extends DbService<Tag> {
  private static instance: EntityTagsService
  constructor() {
    super('tags')
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new EntityTagsService()
    }
    return this.instance
  }
}
