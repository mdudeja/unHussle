import { BaseRepository } from '@/services/database/repositories/BaseRepository'
import { Tag } from '@/types'

export class TagRepository extends BaseRepository<Tag> {
  protected tableName = 'tags'
}
