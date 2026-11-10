import { Project } from '@c/types/index'
import { DbService } from '@/services/database/DbService'

/** Manages project resources and provides access to a shared ProjectsService instance. */
export class ProjectsService extends DbService<Project> {
  private static instance: ProjectsService

  /** Initializes a ProjectsService for managing project resources. */
  constructor() {
    super('projects')
  }

  /** Provides access to the singleton ProjectsService instance. */
  static getInstance() {
    if (!this.instance) {
      this.instance = new ProjectsService()
    }
    return this.instance
  }
}
