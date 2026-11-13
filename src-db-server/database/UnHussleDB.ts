import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { Database, constants } from 'bun:sqlite'
import * as schema from '@d/database/schemas'
import { join, dirname } from 'node:path'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'
import { mkdirSync, existsSync } from 'node:fs'
import { Logger } from '@c/Logger'

/** Manages the application’s SQLite database, providing shared access to an initialized, migration-ready database instance. */
export class UnHussleDB {
  private dbFilePath?: string
  private static instance: UnHussleDB | null = null
  private sqlite: Database | null = null
  private db: BunSQLiteDatabase<typeof schema> | null = null
  private dbReady: boolean = false

  /** Initializes the database file path used by this instance. */
  constructor(file_path?: string) {
    this.dbFilePath =
      file_path ||
      process.env.DB_FILE_URL ||
      join(process.cwd(), './db/ecn.unhussle.sqlite')
  }

  /** Returns the shared UnHussleDB instance, creating it when absent or replacing it when a different file path is requested. */
  public static getInstance(file_path?: string): UnHussleDB {
    if (
      !this.instance ||
      (file_path && this.instance.dbFilePath !== file_path)
    ) {
      this.instance = new UnHussleDB(file_path)
    }
    return this.instance
  }

  /** Indicates whether the database is ready for use. */
  public isReady() {
    return this.dbReady
  }

  /** The SQLite file, or `:memory:`. */
  public get filePath() {
    return this.dbFilePath
  }

  /** Initializes the database by applying pending migrations and marking it ready for use. */
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

  /**
   * Closes the connection. Closing the last connection checkpoints the WAL
   * into the database file and removes the -wal and -shm files.
   * Throws if SQLite cannot close it.
   */
  public close() {
    this.dbReady = false
    this.db = null
    this.sqlite?.close(true)
    this.sqlite = null
  }

  /** Ensures the database is initialized and provides access to it for use. */
  public async getDb() {
    if (this.db && this.dbReady) {
      return this.db
    }

    // Ensure the parent directory exists
    const dbDir = dirname(this.dbFilePath!)

    if (!existsSync(dbDir)) {
      Logger.getInstance().info(`Creating database directory: ${dbDir}`)
      mkdirSync(dbDir, { recursive: true })
    }

    const sqlite = new Database(this.dbFilePath)

    // Some macOS builds keep the -wal file after close unless told not to.
    sqlite.fileControl(constants.SQLITE_FCNTL_PERSIST_WAL, 0)
    sqlite.run('PRAGMA foreign_keys = ON;')
    sqlite.run('PRAGMA journal_mode = WAL;')
    sqlite.run('PRAGMA synchronous = NORMAL;')

    this.sqlite = sqlite
    this.db = drizzle({ client: sqlite, schema })

    if (!this.dbReady) {
      this.initDb()
    }

    return this.db
  }
}
