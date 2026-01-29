import { tasksSchema } from '@d/database/schemas/tasks.schema'
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
    base: tasksSchema,
  },
})
