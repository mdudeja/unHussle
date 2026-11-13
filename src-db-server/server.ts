import { Elysia, ElysiaCustomStatusResponse } from 'elysia'
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
import { schedulerRoutes } from './routes/scheduler'
import { vaultRoutes } from './routes/vault'
import { extensionRoutes } from '@d/routes/extensions'
import { backendRuntime } from '@d/bootstrap'

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

try {
  await backendRuntime.extensionManager.rescan()
} catch (error) {
  logger.error('Could not load extensions', { error })
}

const PORT = parseInt(process.env.VITE_DB_SERVER_PORT || '3456', 10)
// Set by the app per launch; without it, POST /shutdown is refused.
const SHUTDOWN_TOKEN = process.env.DB_SERVER_SHUTDOWN_TOKEN

const app = new Elysia()
  .decorate('logger', logger)
  .use(httpTracing)

  .mapResponse(({ responseValue, set, path }) => {
    // Skip compression for Swagger documentation routes and raw responses
    // (e.g. the `/events` stream, which must not be buffered). Elysia also
    // calls this after each error hook; an error hook that answers nothing
    // must not end error handling before the route's own hook sets a status.
    if (
      path?.startsWith('/api') ||
      responseValue instanceof Response ||
      responseValue === undefined
    ) {
      return
    }

    // Error hooks answer with `status(code, body)`: send the body under its code.
    let value: unknown = responseValue
    let status = typeof set.status === 'number' ? set.status : 200
    if (responseValue instanceof ElysiaCustomStatusResponse) {
      const custom = responseValue as { code: number; response: unknown }
      status = custom.code
      value = custom.response
    }

    const isJson = typeof value === 'object' && value !== null
    const text = isJson
      ? JSON.stringify(value)
      : // Non-objects are primitives (or undefined)
        String((value as string | number | boolean | undefined) ?? '')

    const compressedText = Bun.gzipSync(text)

    set.headers['Content-Encoding'] = 'gzip'
    set.headers['Content-Length'] = String(compressedText.byteLength)
    set.headers['Content-Type'] = isJson
      ? 'application/json; charset=utf-8'
      : 'text/plain; charset=utf-8'

    return new Response(compressedText, { status })
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

  // Runs before the routes' own error hooks, so it only answers validation
  // errors; returning anything else would hide their 404/409/400 statuses.
  .onError(({ error, code, path, logger }) => {
    logger.error(`Error on ${path}`, { error })
    if (code === 'VALIDATION') {
      return error.detail(error.message)
    }
  })

  // Only the app knows the token, so other local pages cannot stop the server.
  .post('/shutdown', ({ headers, set }) => {
    if (!SHUTDOWN_TOKEN || headers['x-shutdown-token'] !== SHUTDOWN_TOKEN) {
      set.status = 403
      return 'Forbidden'
    }
    // Answer first; stopping aborts open requests, this one included.
    setTimeout(() => void shutdown('shutdown request'), 0)
    set.status = 202
    return 'Shutting down'
  })
  .get('/health', ({ set, logger }) => {
    if (process.env.NODE_ENV === 'test' && process.env.UNHUSSLE_TEST_RUN_ID)
      set.headers['x-test-server-id'] = process.env.UNHUSSLE_TEST_RUN_ID
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
  .use(schedulerRoutes)
  .use(vaultRoutes)
  .use(extensionRoutes)

  // backend events, streamed to the frontend
  .use(eventRoutes)

  // spans recorded by this process, for the dev inspector
  .use(telemetryRoutes)

  .listen(PORT)

logger.debug(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)

// The app asks via POST /shutdown on quit (see src-tauri/src/lib.rs), since
// Windows has no SIGTERM; Ctrl+C sends SIGINT. Closing the database leaves
// no -wal or -shm files behind.
let shuttingDown = false
async function shutdown(reason: string) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info(`Received ${reason}, shutting down...`)
  try {
    // Abort open requests too, e.g. the `/events` stream that never ends.
    await app.stop(true)
    uDB.close()
    logger.info('Database closed.')
    process.exit(0)
  } catch (error) {
    logger.error('Could not shut down cleanly', { error })
    process.exit(1)
  }
}
process.once('SIGTERM', (signal) => void shutdown(signal))
process.once('SIGINT', (signal) => void shutdown(signal))

export type App = typeof app
