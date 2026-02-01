import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from '@d/database/schemas'
import { join, dirname } from 'node:path'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdirSync, existsSync } from 'node:fs'

export class UnHussleDB {
  private dbFilePath?: string
  private static instance: UnHussleDB | null = null
  private db: BunSQLiteDatabase<typeof schema> | null = null
  private dbReady: boolean = false

  constructor(file_path?: string) {
    this.dbFilePath =
      file_path ||
      process.env.DB_FILE_URL ||
      join(process.cwd(), './db/ecn.unhussle.sqlite')
  }

  public static getInstance(file_path?: string): UnHussleDB {
    if (
      !this.instance ||
      (file_path && this.instance.dbFilePath !== file_path)
    ) {
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

    const migrationsDir =
      process.env.DB_MIGRATIONS_DIR ||
      join(process.cwd(), './drizzle_migrations')

    migrate(this.db, { migrationsFolder: migrationsDir })
    this.dbReady = true
  }

  public async getDb() {
    if (this.db && this.dbReady) {
      return this.db
    }

    // Ensure the parent directory exists
    const dbDir = dirname(this.dbFilePath!)

    if (!existsSync(dbDir)) {
      console.log(`Creating database directory: ${dbDir}`)
      mkdirSync(dbDir, { recursive: true })
    }

    const sqlite = new Database(this.dbFilePath)

    sqlite.run('PRAGMA foreign_keys = ON;')
    sqlite.run('PRAGMA journal_mode = WAL;')
    sqlite.run('PRAGMA synchronous = NORMAL;')

    this.db = drizzle({ client: sqlite, schema })

    if (!this.dbReady) {
      this.initDb()
    }

    return this.db
  }
}
