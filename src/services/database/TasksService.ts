import { Task } from '@c/types/index'
import { DbService } from '@/services/database/DbService'

export class TasksService extends DbService<Task> {
  private static instance: TasksService
  constructor() {
    super('tasks')
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new TasksService()
    }
    return this.instance
  }
}
