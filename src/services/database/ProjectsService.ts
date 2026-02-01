import { Project } from '@c/index'
import { DbService } from '@/services/database/DbService'

export class ProjectsService extends DbService<Project> {
  private static instance: ProjectsService

  constructor() {
    super('projects')
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new ProjectsService()
    }
    return this.instance
  }
}
