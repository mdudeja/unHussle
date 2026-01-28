import { Elysia } from 'elysia'
import { swagger } from '@elysiajs/swagger'
import { cors } from '@elysiajs/cors'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { tasksRoutes } from './routes/tasks'

console.log('Initializing Database...')
const uDB = UnHussleDB.getInstance()
await uDB.getDb()
console.log('Database Initialized.')

const PORT = parseInt(process.env.VITE_DB_SERVER_PORT || '3456', 10)

const app = new Elysia()
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
  .use(tasksRoutes)
  .listen(PORT)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)

export type App = typeof app
