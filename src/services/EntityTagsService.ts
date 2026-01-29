import { EntityTag } from '@c/index'
import { DbService } from '@/services/DbService'

export class EntityTagsService extends DbService<EntityTag> {
  private static instance: EntityTagsService
  constructor() {
    super('entity_tags')
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new EntityTagsService()
    }
    return this.instance
  }
}
