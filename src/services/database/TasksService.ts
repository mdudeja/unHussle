import { Task } from '@c/types/index'
import { DbService } from '@/services/database/DbService'

/** Service for managing task resources. */
export class TasksService extends DbService<Task> {
  private static instance: TasksService
  /** Initializes the tasks service configured to manage task resources. */
  constructor() {
    super('tasks')
  }

  /** Provides access to the single shared TasksService instance. */
  static getInstance() {
    if (!this.instance) {
      this.instance = new TasksService()
    }
    return this.instance
  }
}
