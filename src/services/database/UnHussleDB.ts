import 'dotenv/config'
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'
import * as schema from './schemas'

export class UnHussleDB {
  private dbFilePath?: string
  private static instance: UnHussleDB | null = null
  private db: BunSQLiteDatabase<typeof schema> | null = null

  constructor(file_path?: string) {
    this.dbFilePath = file_path || process.env.DB_FILE_NAME || 'unhussle.db'
  }

  public static getInstance(file_path?: string): UnHussleDB {
    if (!this.instance) {
      this.instance = new UnHussleDB(file_path)
    }
    return this.instance
  }

  public async getDb() {
    if (this.db) {
      return this.db
    }

    const sqlite = new Database(this.dbFilePath)
    this.db = drizzle({ client: sqlite, schema })

    return this.db
  }
}
