import { BaseRepository } from '@/services/database/repositories/BaseRepository'
import { Area } from '@/types'

export class AreaRepository extends BaseRepository<Area> {
  protected tableName = 'areas'
}
