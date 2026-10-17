import {
  areas,
  tags,
  urls,
  goals,
  projects,
  resources,
  tasks,
  timeEntries,
} from '@d/database/schemas'
import {
  insertAreaSchema,
  insertTagsSchema,
  insertUrlsSchema,
  insertGoalSchema,
  insertProjectSchema,
  insertResourceSchema,
  insertTaskSchema,
  insertTimeEntriesSchema,
  selectAreaSchema,
  selectTagsSchema,
  selectUrlsSchema,
  selectGoalSchema,
  selectProjectSchema,
  selectResourceSchema,
  selectTaskSchema,
  selectTimeEntriesSchema,
  updateAreaSchema,
  updateTagsSchema,
  updateUrlsSchema,
  updateGoalSchema,
  updateProjectSchema,
  updateResourceSchema,
  updateTaskSchema,
  updateTimeEntriesSchema,
} from '@d/database/validation'
import { Elysia } from 'elysia'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { eq } from 'drizzle-orm'
import { Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { Logger } from '@c/Logger'

export type RouteGeneratorSchemas =
  | {
      insert: typeof insertTaskSchema
      select: typeof selectTaskSchema
      update: typeof updateTaskSchema
      base: typeof tasks
    }
  | {
      insert: typeof insertAreaSchema
      select: typeof selectAreaSchema
      update: typeof updateAreaSchema
      base: typeof areas
    }
  | {
      insert: typeof insertGoalSchema
      select: typeof selectGoalSchema
      update: typeof updateGoalSchema
      base: typeof goals
    }
  | {
      insert: typeof insertProjectSchema
      select: typeof selectProjectSchema
      update: typeof updateProjectSchema
      base: typeof projects
    }
  | {
      insert: typeof insertTagsSchema
      select: typeof selectTagsSchema
      update: typeof updateTagsSchema
      base: typeof tags
    }
  | {
      insert: typeof insertResourceSchema
      select: typeof selectResourceSchema
      update: typeof updateResourceSchema
      base: typeof resources
    }
  | {
      insert: typeof insertUrlsSchema
      select: typeof selectUrlsSchema
      update: typeof updateUrlsSchema
      base: typeof urls
    }
  | {
      insert: typeof insertTimeEntriesSchema
      select: typeof selectTimeEntriesSchema
      update: typeof updateTimeEntriesSchema
      base: typeof timeEntries
    }

// Initialize DB Access
const uDB = UnHussleDB.getInstance()
const db = await uDB.getDb()

export type RouteGeneratorConfig = {
  name: keyof (typeof db)['query']
  prefix: string
  schemas: RouteGeneratorSchemas
}

export const routeGenerator = (config: RouteGeneratorConfig) => {
  return new Elysia({ prefix: config.prefix, name: config.name })
    .decorate('db', db)
    .decorate('logger', Logger.getInstance())
    .onError(({ code, status, error, logger }) => {
      logger.error(`Error in ${config.name} route: ${{ code, status, error }}`)

      if (code === 'NOT_FOUND') {
        return status(404, `${config.name} not found`)
      }

      return status(500, 'Internal Server Error')
    })

    .get(
      '/',
      async ({ logger }) => {
        logger.debug(`Get All ${config.name}`)
        const ps = uDB.getPreparedStatement(config.name, 'get_all')
        if (!ps) {
          throw new Error('Prepared statement not found: get_all')
        }

        return Value.Parse(Type.Array(config.schemas.select), ps.all())
      },
      {
        response: Type.Array(config.schemas.select),
      },
    )

    .get(
      '/paginated/:page/:pageSize',
      async ({ logger, params: { page, pageSize } }) => {
        logger.debug(
          `Get Paged ${config.name} with page: ${page}, pageSize: ${pageSize}`,
        )
        const ps = uDB.getPreparedStatement(config.name, 'get_paginated')
        if (!ps) {
          throw new Error('Prepared statement not found: get_paged')
        }

        try {
          const limit = parseInt(pageSize, 10)
          const offset = (parseInt(page, 10) - 1) * limit

          return Value.Parse(
            Type.Array(config.schemas.select),
            ps.all({ limit, offset }),
          )
        } catch (error) {
          throw new Error(`Invalid page or pageSize: ${error}`)
        }
      },
      {
        response: Type.Array(config.schemas.select),
      },
    )

    .get(
      '/:id',
      async ({ params: { id }, logger }) => {
        logger.debug(`Get ${config.name} with id: ${id}`)
        const ps = uDB.getPreparedStatement(config.name, 'get_by_id')

        if (!ps) {
          throw new Error('Prepared statement not found: get_by_id')
        }

        const result = ps.get({ id })

        if (!result) {
          throw new Error('NOT_FOUND')
        }

        return Value.Parse(config.schemas.select, result)
      },
      {
        response: config.schemas.select,
      },
    )

    .get(
      '/search/:term',
      async ({ params: { term }, logger }) => {
        logger.debug(`Search ${config.name} with term: ${term}`)

        const ps = uDB.getPreparedStatement(config.name, 'search')

        if (!ps) {
          throw new Error('Prepared statement not found: search')
        }

        const values = ps.all({ term: `%${term.toLowerCase()}%` })

        const result = Value.Parse(Type.Array(config.schemas.select), values)

        return result
      },
      {
        response: Type.Array(config.schemas.select),
      },
    )

    .post(
      '/',
      async ({ body, set, db, logger }) => {
        logger.debug(`Add ${config.name} with id: ${body.id}`)
        const result = await db
          .insert(config.schemas.base)
          .values(body)
          .returning()

        if (!result.length || !result[0]) {
          set.status = 500
          throw new Error('Failed to insert task')
        }

        return Value.Parse(config.schemas.select, result[0])
      },
      {
        body: config.schemas.insert,
        response: config.schemas.select,
      },
    )

    .patch(
      '/:id',
      async ({ params: { id }, body, set, db, logger }) => {
        logger.debug(`Update ${config.name} with id: ${id}`)
        const result = await db
          .update(config.schemas.base)
          .set(body)
          .where(eq(config.schemas.base.id, id))
          .returning()

        if (!result.length || !result[0]) {
          set.status = 500
          throw new Error('Failed to update task')
        }

        return Value.Parse(config.schemas.select, result[0])
      },
      {
        body: config.schemas.update,
        response: config.schemas.select,
      },
    )

    .delete(
      '/all',
      async ({ logger }) => {
        logger.debug(`Delete all ${config.name} `)
        const result = await db.delete(config.schemas.base).returning()

        return { deleted: result.length }
      },
      {
        response: Type.Object({ deleted: Type.Number() }),
      },
    )

    .delete(
      '/:id',
      async ({ params: { id }, db, logger }) => {
        logger.debug(`Delete ${config.name} with id: ${id}`)
        const result = await db
          .delete(config.schemas.base)
          .where(eq(config.schemas.base.id, id))
          .returning()

        if (!result.length || !result[0]) {
          throw new Error('NOT_FOUND')
        }

        return Value.Parse(config.schemas.select, result[0])
      },
      {
        response: config.schemas.select,
      },
    )
}
