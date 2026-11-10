import {
  ReadModelsRepository,
  ReadInputError,
} from '@d/database/repositories/readModels'
import { referencesQuerySchema, taskPageQuerySchema } from './readModels'
import {
  entityReferenceSchema,
  selectContainerDetailSchema,
} from '@d/database/validation'
import type { ReadContainerKind } from '@c/types/readModels'
import { backendRuntime } from '@d/workflows/runtime'
import { operationIdHeader, traceOf } from '@d/routes/telemetry'
import { commandHeadForKind, type EntryKind } from '@c/workflows/contracts'
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
import { VaultConflict, VaultError } from '@d/vault/vault'

const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : ''

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
  kind: EntryKind
  schemas: RouteGeneratorSchemas
  repository: IRepository<T>
}

export const routeGenerator = <
  T extends { Read: unknown; Write: unknown; Update: unknown },
>(
  config: RouteGeneratorConfig<T>,
) => {
  const head = commandHeadForKind[config.kind]
  const reads = new ReadModelsRepository(uDB)

  return new Elysia({ prefix: config.prefix, name: config.name })
    .decorate('db', db)
    .decorate('logger', Logger.getInstance())
    .onError(({ code, status, error, logger }) => {
      logger.error(`Error in ${config.name} route (${code})`, { error })

      if (code === 'NOT_FOUND' || messageOf(error) === 'NOT_FOUND') {
        return status(404, `${config.name} not found`)
      }

      // Title collisions: unique updates throw, inserts are skipped on conflict.
      const message = messageOf(error)
      if (
        message.includes('UNIQUE constraint failed') ||
        message.startsWith('Failed to insert')
      ) {
        return status(409, {
          message: 'An item with this title already exists',
        })
      }
      if (error instanceof VaultConflict) {
        return status(409, { message })
      }
      if (error instanceof ReadInputError) return status(400, { message })
      if (code === 'VALIDATION')
        return status(422, { message: 'Invalid request parameters' })
      if (error instanceof VaultError) {
        return status(400, { message })
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
      '/references',
      ({ query }) =>
        reads.references(config.kind, {
          ...query,
          ids: query.ids === undefined ? undefined : query.ids.split(','),
        }),
      {
        query: referencesQuerySchema,
        response: Type.Object({
          items: Type.Array(entityReferenceSchema),
          total: Type.Integer(),
          nextCursor: Type.Union([Type.String(), Type.Null()]),
        }),
      },
    )

    .get(
      '/:id/detail',
      ({ params: { id }, query }) => {
        if (
          !['projects', 'areas', 'goals', 'tags', 'urls'].includes(config.kind)
        )
          throw new Error('NOT_FOUND')
        return reads.detail(config.kind as ReadContainerKind, id, query)
      },
      { query: taskPageQuerySchema, response: selectContainerDetailSchema },
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
      async ({ body, headers, logger, request }) => {
        logger.debug(`Add ${config.name} with id: ${body.id}`)
        const result = await backendRuntime.commands.execute(
          `${head}.add`,
          {
            kind: config.kind,
            action: 'create',
            operationId: headers[operationIdHeader],
            changes: body,
          },
          traceOf(request),
        )

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
      async ({ params: { id }, body, headers, logger, request }) => {
        logger.debug(`Update ${config.name} with id: ${id}`)
        const result = await backendRuntime.commands.execute(
          `${head}.change`,
          {
            kind: config.kind,
            action: 'update',
            operationId: headers[operationIdHeader],
            id,
            changes: body,
          },
          traceOf(request),
        )

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
      async ({ headers, logger, request }) => {
        logger.debug(`Delete all ${config.name} `)
        const result = await backendRuntime.commands.execute(
          `${head}.deleteAll`,
          {
            kind: config.kind,
            action: 'deleteAll',
            operationId: headers[operationIdHeader],
          },
          traceOf(request),
        )

        return { deleted: Array.isArray(result) ? result.length : 0 }
      },
      {
        response: Type.Object({ deleted: Type.Number() }),
      },
    )

    .delete(
      '/:id',
      async ({ params: { id }, headers, logger, request }) => {
        logger.debug(`Delete ${config.name} with id: ${id}`)
        const result = await backendRuntime.commands.execute(
          `${head}.delete`,
          {
            kind: config.kind,
            action: 'delete',
            operationId: headers[operationIdHeader],
            id,
          },
          traceOf(request),
        )

        return Value.Parse(config.schemas.select, result)
      },
      {
        response: config.schemas.select,
      },
    )
}
