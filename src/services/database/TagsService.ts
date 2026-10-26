import { Tag } from '@c/types/index'
import { DbService } from '@/services/database/DbService'
import { makeJSONRequest } from '@/lib/server'
import {
  HydratedArea,
  HydratedGoal,
  HydratedProject,
  HydratedTask,
} from '@c/types/Hydrated'

export type TaggedItems = {
  tasks: HydratedTask[]
  projects: HydratedProject[]
  areas: HydratedArea[]
  goals: HydratedGoal[]
}

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

  async fetchItems(id: string) {
    return makeJSONRequest<TaggedItems>({
      url: `${this.dbUrl}/${this.baseEndpoint}/${id}/items`,
      method: 'GET',
    })
  }
}
