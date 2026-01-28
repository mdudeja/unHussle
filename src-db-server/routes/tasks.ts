import { Elysia } from 'elysia'
import { tasksSchema } from '@d/database/schemas/tasks.schema'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { eq } from 'drizzle-orm'
import {
  insertTaskSchema,
  updateTaskSchema,
} from '@d/database/schemas/validation'

// Initialize DB Access
const uDB = UnHussleDB.getInstance()
const db = await uDB.getDb()

export const tasksRoutes = new Elysia({ prefix: '/tasks' })
  .get('/', async () => {
    try {
      console.log('Get all Tasks')
      return await db.select().from(tasksSchema)
    } catch (error) {
      console.error('Failed to get tasks', error)
      return null
    }
  })

  .get('/:id', async ({ params: { id } }) => {
    try {
      console.log('Get Task with id: ', id)
      return await db.select().from(tasksSchema).where(eq(tasksSchema.id, id))
    } catch (error) {
      console.error('Failed to get task', error)
      return null
    }
  })

  .post(
    '/',
    async ({ body }) => {
      try {
        console.log('Add Task with id: ', body.id)
        const result = await db.insert(tasksSchema).values(body).returning()
        return result[0]
      } catch (error) {
        console.error('Failed to add task', error)
        return null
      }
    },
    {
      body: insertTaskSchema,
    },
  )

  .patch(
    '/:id',
    async ({ params: { id }, body }) => {
      try {
        console.log('Update Task with id: ', id)
        const result = await db
          .update(tasksSchema)
          .set(body)
          .where(eq(tasksSchema.id, id))
          .returning()
        return result[0]
      } catch (error) {
        console.error('Failed to update task', error)
        return null
      }
    },
    {
      body: updateTaskSchema,
    },
  )

  .delete('/:id', async ({ params: { id } }) => {
    try {
      console.log('Delete Task with id: ', id)
      const result = await db
        .delete(tasksSchema)
        .where(eq(tasksSchema.id, id))
        .returning()
      return result[0]
    } catch (error) {
      console.error('Failed to delete task', error)
      return null
    }
  })
