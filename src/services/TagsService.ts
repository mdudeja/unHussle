import { EntityTag } from '@c/index'
import { DbService } from '@/services/DbService'

export class TagsService extends DbService<EntityTag> {
  private static instance: TagsService
  constructor() {
    super('entity_tags')
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new TagsService()
    }
    return this.instance
  }
}
