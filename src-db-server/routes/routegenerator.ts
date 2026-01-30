import {
  areasSchema,
  entityTagsSchema,
  goalsSchema,
  projectsSchema,
  tasksSchema,
} from '@d/database/schemas'
import {
  insertAreaSchema,
  insertEntityTagsSchema,
  insertGoalSchema,
  insertProjectSchema,
  insertTaskSchema,
  selectAreaSchema,
  selectEntityTagsSchema,
  selectGoalSchema,
  selectProjectSchema,
  selectTaskSchema,
  updateAreaSchema,
  updateEntityTagsSchema,
  updateGoalSchema,
  updateProjectSchema,
  updateTaskSchema,
} from '@d/database/validation'
import { Elysia } from 'elysia'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { eq } from 'drizzle-orm'

type RouteGeneratorSchemas =
  | {
      insert: typeof insertTaskSchema
      select: typeof selectTaskSchema
      update: typeof updateTaskSchema
      base: typeof tasksSchema
    }
  | {
      insert: typeof insertAreaSchema
      select: typeof selectAreaSchema
      update: typeof updateAreaSchema
      base: typeof areasSchema
    }
  | {
      insert: typeof insertGoalSchema
      select: typeof selectGoalSchema
      update: typeof updateGoalSchema
      base: typeof goalsSchema
    }
  | {
      insert: typeof insertProjectSchema
      select: typeof selectProjectSchema
      update: typeof updateProjectSchema
      base: typeof projectsSchema
    }
  | {
      insert: typeof insertEntityTagsSchema
      select: typeof selectEntityTagsSchema
      update: typeof updateEntityTagsSchema
      base: typeof entityTagsSchema
    }

export type RouteGeneratorConfig = {
  name: string
  prefix: string
  schemas: RouteGeneratorSchemas
}

// Initialize DB Access
const uDB = UnHussleDB.getInstance()
const db = await uDB.getDb()

export const routeGenerator = (config: RouteGeneratorConfig) => {
  return new Elysia({ prefix: config.prefix, name: config.name })
    .decorate('db', db)
    .onError(({ code, status, error }) => {
      console.error('Error occurred:', { code, status, error })

      if (code === 'NOT_FOUND') {
        return status(404, 'Task not found')
      }

      return status(500, 'Internal Server Error')
    })

    .get(
      '/',
      async ({ db }) => {
        console.log(`Get All ${config.name}`)
        return await db.select().from(config.schemas.base)
      },
      {
        response: Array(config.schemas.select),
      },
    )

    .get(
      '/:id',
      async ({ params: { id }, db }) => {
        console.log(`Get ${config.name} with id: `, id)
        const result = await db
          .select()
          .from(config.schemas.base)
          .where(eq(config.schemas.base.id, id))
          .limit(1)

        if (!result.length || !result[0]) {
          throw new Error('NOT_FOUND')
        }

        return result[0]
      },
      {
        response: config.schemas.select,
      },
    )

    .post(
      '/',
      async ({ body, set, db }) => {
        console.log(`Add ${config.name} with id: `, body.id)
        const result = await db
          .insert(config.schemas.base)
          .values(body)
          .returning()

        if (!result.length || !result[0]) {
          set.status = 500
          throw new Error('Failed to insert task')
        }

        return result[0]
      },
      {
        body: config.schemas.insert,
        response: config.schemas.select,
      },
    )

    .patch(
      '/:id',
      async ({ params: { id }, body, set, db }) => {
        console.log(`Update ${config.name} with id: `, id)
        const result = await db
          .update(config.schemas.base)
          .set(body)
          .where(eq(config.schemas.base.id, id))
          .returning()
        if (!result.length || !result[0]) {
          set.status = 500
          throw new Error('Failed to update task')
        }
        return result[0]
      },
      {
        body: config.schemas.update,
        response: config.schemas.select,
      },
    )

    .delete('/all', async () => {
      console.log(`Delete all ${config.name} `)
      const result = await db.delete(config.schemas.base).returning()

      return result
    })

    .delete(
      '/:id',
      async ({ params: { id }, db }) => {
        console.log(`Delete ${config.name} with id: `, id)
        const result = await db
          .delete(config.schemas.base)
          .where(eq(config.schemas.base.id, id))
          .returning()

        if (!result.length || !result[0]) {
          throw new Error('NOT_FOUND')
        }

        return result[0]
      },
      {
        response: config.schemas.select,
      },
    )
}
