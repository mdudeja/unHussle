import { BaseRepository } from '@/services/database/repositories/BaseRepository'
import { Project } from '@/types'

export class ProjectRepository extends BaseRepository<Project> {
  protected tableName = 'projects'
}
