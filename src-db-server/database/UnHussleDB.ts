import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from '@d/database/schemas'
import { fileURLToPath } from 'bun'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

export class UnHussleDB {
  private dbFilePath?: string
  private static instance: UnHussleDB | null = null
  private db: BunSQLiteDatabase<typeof schema> | null = null
  private dbReady: boolean = false

  constructor(file_path?: string) {
    this.dbFilePath = fileURLToPath(
      new URL(
        file_path || process.env.DB_FILE_URL || './db/ecn:unhussle.sqlite',
        import.meta.url,
      ),
    )
  }

  public static getInstance(file_path?: string): UnHussleDB {
    if (!this.instance) {
      this.instance = new UnHussleDB(file_path)
    }
    return this.instance
  }

  public isReady() {
    return this.dbReady
  }

  private initDb() {
    if (!this.db) {
      throw new Error('Database not initialized')
    }

    const migrationsDir = fileURLToPath(
      new URL(
        process.env.DB_MIGRATIONS_DIR || './drizzle_migrations',
        import.meta.url,
      ),
    )

    migrate(this.db, { migrationsFolder: migrationsDir })
    this.dbReady = true
  }

  public async getDb() {
    if (this.db && this.dbReady) {
      return this.db
    }

    const sqlite = new Database(this.dbFilePath)
    this.db = drizzle({ client: sqlite, schema })

    if (!this.dbReady) {
      this.initDb()
    }

    return this.db
  }
}
