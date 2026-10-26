import { Task } from '@c/types/index'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'

export interface TasksSlice {
  tasks: DbSlice<Task>
}

export const createTasksSlice = generateCreateDbConnectedStateSlice<
  Task,
  'tasks'
>('tasks')
