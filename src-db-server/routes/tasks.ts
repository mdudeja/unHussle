import { TasksRepository } from '@d/database/repositories/tasks'
import { tasks } from '@d/database/schemas/tasks.schema'
import { UnHussleDB } from '@d/database/UnHussleDB'
import {
  insertTaskSchema,
  selectTaskSchema,
  updateTaskSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'

export const taskRoutes = routeGenerator({
  name: 'tasks',
  prefix: '/tasks',
  schemas: {
    insert: insertTaskSchema,
    select: selectTaskSchema,
    update: updateTaskSchema,
    base: tasks,
  },
  repository: new TasksRepository(UnHussleDB.getInstance()),
})
