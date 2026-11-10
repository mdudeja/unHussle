import type { UnHussleDB } from '@d/database/UnHussleDB'
import type { TaskPageOptions } from '@c/types/readModels'
import { ReadModelsRepository } from './readModels'

/** Tags and URLs share the same explicit projection and membership pagination. */
export class SupporterItemsRepository {
  private readonly reads: ReadModelsRepository
  constructor(database: UnHussleDB) {
    this.reads = new ReadModelsRepository(database)
  }
  getItems(kind: 'tags' | 'urls', id: string, options?: TaskPageOptions) {
    return this.reads.detail(kind, id, options)
  }
}
