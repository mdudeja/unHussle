import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { taskRoutes } from '@d/routes/tasks'
import { areaRoutes } from '@d/routes/areas'
import { goalRoutes } from '@d/routes/goals'
import { projectRoutes } from '@d/routes/projects'
import { entityTagRoutes } from '@d/routes/entity_tags'

console.log('Initializing Database...')
const uDB = UnHussleDB.getInstance()
await uDB.getDb()
console.log('Database Initialized.')

const PORT = parseInt(process.env.VITE_DB_SERVER_PORT || '3456', 10)
const encoder = new TextEncoder()

const app = new Elysia()
  .mapResponse(({ responseValue, set }) => {
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
  .onError(({ error, code }) => {
    console.error(error)
    if (code === 'VALIDATION') {
      return error.detail(error.message)
    }
    return error
  })
  .get('/health', () => 'OK')
  .use(taskRoutes)
  .use(areaRoutes)
  .use(goalRoutes)
  .use(projectRoutes)
  .use(entityTagRoutes)
  .listen(PORT)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)

export type App = typeof app
