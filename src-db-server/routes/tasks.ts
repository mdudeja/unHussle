import { t } from 'elysia'
import { Value } from '@sinclair/typebox/value'
import { TasksRepository } from '@d/database/repositories/tasks'
import { getTaskContext } from '@d/database/repositories/taskContext'
import { tasks } from '@d/database/schemas/tasks.schema'
import { UnHussleDB } from '@d/database/UnHussleDB'
import {
  insertTaskSchema,
  selectTaskContextSchema,
  selectTaskSchema,
  updateTaskSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'

const uDB = UnHussleDB.getInstance()

export const taskRoutes = routeGenerator({
  name: 'tasks',
  prefix: '/tasks',
  kind: 'tasks',
  schemas: {
    insert: insertTaskSchema,
    select: selectTaskSchema,
    update: updateTaskSchema,
    base: tasks,
  },
  repository: new TasksRepository(uDB),
})
  // Own and inherited resources, links and tags, for the task card.
  .get(
    '/:id/context',
    async ({ params: { id } }) => {
      const context = getTaskContext(await uDB.getDb(), id)
      if (!context) throw new Error('NOT_FOUND')
      return Value.Parse(selectTaskContextSchema, context)
    },
    {
      params: t.Object({ id: t.String() }),
      response: selectTaskContextSchema,
    },
  )
