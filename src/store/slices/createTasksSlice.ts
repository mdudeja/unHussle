import { Task } from '@c/index'
import { TasksService } from '@/services/database/TasksService'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'

export interface TasksSlice {
  tasks: DbSlice<Task>
}

export const createTasksSlice = generateCreateDbConnectedStateSlice<
  Task,
  'tasks'
>(TasksService.getInstance(), 'tasks')
