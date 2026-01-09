import { BaseRepository } from '@/services/database/repositories/BaseRepository'
import { Goal } from '@/types'

export class GoalRepository extends BaseRepository<Goal> {
  protected tableName = 'goals'
}
