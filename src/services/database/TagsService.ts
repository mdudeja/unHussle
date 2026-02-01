import { Tag } from '@c/types/index'
import { DbService } from '@/services/database/DbService'

export class TagsService extends DbService<Tag> {
  private static instance: TagsService
  constructor() {
    super('tags')
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new TagsService()
    }
    return this.instance
  }
}
