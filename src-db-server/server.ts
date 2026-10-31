import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { taskRoutes } from '@d/routes/tasks'
import { areaRoutes } from '@d/routes/areas'
import { goalRoutes } from '@d/routes/goals'
import { projectRoutes } from '@d/routes/projects'
import { tagRoutes } from '@d/routes/tags'
import { resourcesRoutes } from './routes/resources'
import { urlRoutes } from './routes/urls'
import { timeEntriesRoutes } from './routes/time_entries'
import { eventRoutes } from './routes/events'
import { httpTracing, telemetryRoutes } from './routes/telemetry'
import { runSeed } from './database/seed/run-seed'
import { Logger } from '@c/Logger'
import { VERSION } from '@c/version'

const logger = Logger.getInstance()

logger.debug('Initializing Database...')
const uDB = UnHussleDB.getInstance()
await uDB.getDb()
logger.debug('Database Initialized.')

try {
  await runSeed()
} catch (error) {
  logger.error('Error running seed data', { error })
}

const PORT = parseInt(process.env.VITE_DB_SERVER_PORT || '3456', 10)

const app = new Elysia()
  .decorate('logger', logger)
  .use(httpTracing)

  .mapResponse(({ responseValue, set, path }) => {
    // Skip compression for Swagger documentation routes and raw responses
    // (e.g. the `/events` stream, which must not be buffered).
    if (path?.startsWith('/api') || responseValue instanceof Response) {
      return
    }

    const isJson = typeof responseValue === 'object'
    const text = isJson
      ? JSON.stringify(responseValue)
      : // Non-objects are primitives (or undefined)
        String((responseValue as string | number | boolean | undefined) ?? '')

    const compressedText = Bun.gzipSync(text)

    set.headers['Content-Encoding'] = 'gzip'
    set.headers['Content-Length'] = String(compressedText.byteLength)
    set.headers['Content-Type'] = isJson
      ? 'application/json; charset=utf-8'
      : 'text/plain; charset=utf-8'

    return new Response(compressedText)
  })

  .use(
    swagger({
      path: '/api',
      documentation: {
        info: {
          title: 'unHussle API',
          version: VERSION,
        },
      },
    }),
  )

  .use(cors())

  .onError(({ error, code, path, logger }) => {
    logger.error(`Error on ${path}`, { error })
    if (code === 'VALIDATION') {
      return error.detail(error.message)
    }
    return error
  })

  .get('/health', ({ set, logger }) => {
    const dbReady = uDB.isReady()
    logger.debug(`Health check - DB ready: ${dbReady}`)
    if (dbReady) {
      set.status = 200
      return 'OK'
    }
    set.status = 503
    return 'Database not ready'
  })
  // entities
  .use(taskRoutes)
  .use(resourcesRoutes)

  // collections
  .use(areaRoutes)
  .use(goalRoutes)
  .use(projectRoutes)

  // supporters
  .use(tagRoutes)
  .use(urlRoutes)
  .use(timeEntriesRoutes)

  // backend events, streamed to the frontend
  .use(eventRoutes)

  // spans recorded by this process, for the dev inspector
  .use(telemetryRoutes)

  .listen(PORT)

logger.debug(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)

export type App = typeof app
