import { UnHussleDB } from './src/services/database/UnHussleDB'
import { sql as sqlTemplate } from 'drizzle-orm'

const PORT = 3456

// Initialize database (without migrations - Tauri will handle schema setup)
const db = await UnHussleDB.getInstance().getDb()
console.log('Database initialized (skipping migrations in sidecar mode)')

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    }

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers })
    }

    try {
      // Health check
      if (url.pathname === '/health') {
        return new Response(JSON.stringify({ status: 'ok' }), { headers })
      }

      // Execute raw SQL query
      if (url.pathname === '/query' && req.method === 'POST') {
        const { query, params } = await req.json()
        const result = await db.run(sqlTemplate.raw(query))
        return new Response(JSON.stringify(result), { headers })
      }

      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers,
      })
    } catch (error) {
      console.error('Error:', error)
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers },
      )
    }
  },
})

console.log(`Database server running on http://localhost:${PORT}`)
