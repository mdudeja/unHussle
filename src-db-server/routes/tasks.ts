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
    return await db.select().from(tasksSchema)
  })

  .post(
    '/',
    async ({ body }) => {
      const result = await db.insert(tasksSchema).values(body).returning()
      return result[0]
    },
    {
      body: insertTaskSchema,
    },
  )

  .patch(
    '/:id',
    async ({ params: { id }, body }) => {
      const result = await db
        .update(tasksSchema)
        .set(body)
        .where(eq(tasksSchema.id, id))
        .returning()
      return result[0]
    },
    {
      body: updateTaskSchema,
    },
  )

  .delete('/:id', async ({ params: { id } }) => {
    const result = await db
      .delete(tasksSchema)
      .where(eq(tasksSchema.id, id))
      .returning()
    return result[0]
  })
