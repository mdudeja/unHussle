import 'dotenv/config'
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { Database } from 'bun:sqlite'

export class UnHussleDB {
  private static instance: UnHussleDB | null = null
  private db: BunSQLiteDatabase | null = null

  public static getInstance(): UnHussleDB {
    if (!this.instance) {
      this.instance = new UnHussleDB()
    }
    return this.instance
  }

  public async getDb() {
    if (this.db) {
      return this.db
    }

    const sqlite = new Database(process.env.DB_FILE_NAME)
    this.db = drizzle({ client: sqlite })

    return this.db
  }
}
