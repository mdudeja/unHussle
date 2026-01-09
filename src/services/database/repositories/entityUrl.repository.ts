import { BaseRepository } from '@/services/database/repositories/BaseRepository'
import { EntityUrl } from '@/types'

export class EntityUrlRepository extends BaseRepository<EntityUrl> {
  protected tableName = 'entity_urls'
}
