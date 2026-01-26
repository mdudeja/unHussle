import { UnHussleDB } from './database/UnHussleDB'
import { BunRequest } from 'bun'

const PORT = parseInt(process.env.DB_SERVER_PORT || '3456', 10)
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
}

const db = await UnHussleDB.getInstance()

Bun.serve({
  development: process.env.NODE_ENV !== 'production',
  port: PORT,
  routes: {
    '/health': {
      GET: (_req: BunRequest) => {
        if (!db) {
          return new Response('Database not initialized', {
            status: 500,
            headers,
          })
        }

        if (!db.isReady()) {
          return new Response('Database not ready', {
            status: 500,
            headers,
          })
        }

        return new Response('OK', { headers })
      },
    },
  },
  fetch(_req: BunRequest) {
    return new Response('URL Not Found. Use /health endpoint to check status', {
      status: 404,
      headers,
    })
  },
})

console.log(`Database server running on http://localhost:${PORT}`)
