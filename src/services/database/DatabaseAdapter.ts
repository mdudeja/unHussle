import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import * as schema from './schemas'

const DB_SERVER_URL = 'http://localhost:3456'
const isTauri = '__TAURI_INTERNALS__' in window

export class DatabaseAdapter {
  private db: BunSQLiteDatabase<typeof schema> | null = null
  private serverMode = false

  async initialize() {
    if (isTauri) {
      // Use HTTP server for database access in Tauri
      this.serverMode = true
      console.log('Using database server mode')

      // Check if server is running
      try {
        const response = await fetch(`${DB_SERVER_URL}/health`)
        if (!response.ok) throw new Error('Server not responding')
      } catch (error) {
        throw new Error(
          'Database server not running. Please start it with: bun run server',
        )
      }
    } else {
      // Use direct bun:sqlite in browser
      const { UnHussleDB } = await import('./UnHussleDB')
      const { migrate } = await import('drizzle-orm/bun-sqlite/migrator')

      this.db = await UnHussleDB.getInstance().getDb()
      await migrate(this.db, { migrationsFolder: './drizzle_migrations' })
      console.log('Using direct database mode')
    }
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    if (this.serverMode) {
      const response = await fetch(`${DB_SERVER_URL}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, params }),
      })

      if (!response.ok) {
        throw new Error(`Query failed: ${response.statusText}`)
      }

      return response.json()
    } else {
      if (!this.db) throw new Error('Database not initialized')
      // Direct drizzle queries would go here
      // For now, this is a placeholder
      throw new Error('Direct query not implemented yet')
    }
  }

  getDb() {
    if (this.serverMode) {
      throw new Error('Cannot access db directly in server mode')
    }
    return this.db
  }

  isServerMode() {
    return this.serverMode
  }
}
