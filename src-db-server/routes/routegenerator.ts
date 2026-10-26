import { backendRuntime } from '@d/workflows/runtime'
import type { EntityKind } from '@c/workflows/contracts'
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
import { Type } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { Logger } from '@c/Logger'
import { IRepository } from '@d/database/repositories/IRepository.interface'

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

// Maximum rows returned by the `/search/:term` endpoint.
const parsedSearchLimit = parseInt(
  process.env.VITE_SEARCH_RESULTS_COUNT || '20',
  10,
)

export type RouteGeneratorConfig<
  T extends { Read: unknown; Write: unknown; Update: unknown },
> = {
  name: keyof (typeof db)['query']
  prefix: string
  kind: EntityKind
  schemas: RouteGeneratorSchemas
  repository: IRepository<T>
}

export const routeGenerator = <
  T extends { Read: unknown; Write: unknown; Update: unknown },
>(
  config: RouteGeneratorConfig<T>,
) => {
  return new Elysia({ prefix: config.prefix, name: config.name })
    .decorate('db', db)
    .decorate('logger', Logger.getInstance())
    .onError(({ code, status, error, logger }) => {
      logger.error(
        `Error in ${config.name} route (${code}): ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      )

      if (code === 'NOT_FOUND') {
        return status(404, `${config.name} not found`)
      }

      return status(500, 'Internal Server Error')
    })

    .get(
      '/',
      async ({ logger }) => {
        logger.debug(`Get All ${config.name}`)
        const results = await config.repository.getAll()
        return Value.Parse(Type.Array(config.schemas.select), results)
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
        try {
          const psize = parseInt(pageSize, 10)
          const pg = (parseInt(page, 10) - 1) * psize

          const results = await config.repository.getPaginated(pg, psize)

          return Value.Parse(Type.Array(config.schemas.select), results)
        } catch (error) {
          throw new Error(`Invalid page or pageSize: ${String(error)}`, {
            cause: error,
          })
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
        const result = await config.repository.getById(id)

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

        // Hashtags are stored without `#`, so `#health` should match `health`.
        const normalizedTerm = term.trim().replace(/^#/, '').toLowerCase()

        const values = await config.repository.search(
          normalizedTerm,
          parsedSearchLimit,
        )

        const result = Value.Parse(Type.Array(config.schemas.select), values)

        return result
      },
      {
        response: Type.Array(config.schemas.select),
      },
    )

    .post(
      '/',
      async ({ body, logger }) => {
        logger.debug(`Add ${config.name} with id: ${body.id}`)
        const result = await backendRuntime.commands.execute('entity.mutate', {
          kind: config.kind,
          action: 'create',
          changes: body,
        })

        return Value.Parse(
          config.schemas.select,
          await backendRuntime.hydrate(result, (id) =>
            config.repository.getById(id),
          ),
        )
      },
      {
        body: config.schemas.insert,
        response: config.schemas.select,
      },
    )

    .patch(
      '/:id',
      async ({ params: { id }, body, logger }) => {
        logger.debug(`Update ${config.name} with id: ${id}`)
        const result = await backendRuntime.commands.execute('entity.mutate', {
          kind: config.kind,
          action: 'update',
          id,
          changes: body,
        })

        return Value.Parse(
          config.schemas.select,
          await backendRuntime.hydrate(result, (id) =>
            config.repository.getById(id),
          ),
        )
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
        const result = await backendRuntime.commands.execute('entity.mutate', {
          kind: config.kind,
          action: 'deleteAll',
        })

        return result as { deleted: number }
      },
      {
        response: Type.Object({ deleted: Type.Number() }),
      },
    )

    .delete(
      '/:id',
      async ({ params: { id }, logger }) => {
        logger.debug(`Delete ${config.name} with id: ${id}`)
        const result = await backendRuntime.commands.execute('entity.mutate', {
          kind: config.kind,
          action: 'delete',
          id,
        })

        return Value.Parse(config.schemas.select, result)
      },
      {
        response: config.schemas.select,
      },
    )
}
