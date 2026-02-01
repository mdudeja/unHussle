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
import { convertDateStrings } from './utils/convertDateString'
import { runSeed } from './database/seed/run-seed'

console.log('Initializing Database...')
const uDB = UnHussleDB.getInstance()
await uDB.getDb()
console.log('Database Initialized.')

try {
  await runSeed()
} catch (error) {
  console.error('Error running seed data:', error)
}

const PORT = parseInt(process.env.VITE_DB_SERVER_PORT || '3456', 10)
const encoder = new TextEncoder()

const app = new Elysia()
  .onTransform((context) => {
    // Convert any ISO date strings in the body to Date objects
    if (context.body && typeof context.body === 'object') {
      context.body = convertDateStrings(context.body)
    }
  })
  .mapResponse(({ responseValue, set, path }) => {
    // Skip compression for Swagger documentation routes
    if (path?.startsWith('/api')) {
      return
    }

    const isJson = typeof responseValue === 'object'
    const text = isJson
      ? JSON.stringify(responseValue)
      : String(responseValue?.toString() ?? '')

    const compressedText = Bun.gzipSync(encoder.encode(text))

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
          version: '1.0.0',
        },
      },
    }),
  )
  .use(cors())
  .onError(({ error, code, path }) => {
    console.error(`Error on ${path}: ${(error as any).message}`)
    if (code === 'VALIDATION') {
      return error.detail(error.message)
    }
    return error
  })
  .get('/health', () => {
    if (uDB.isReady()) {
      return new Response('OK', { status: 200 })
    }
    return new Response('Database not ready', { status: 503 })
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

  .listen(PORT)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)

export type App = typeof app
