import { Database } from 'bun:sqlite'
import { IDatabaseAdapter } from './IDatabaseAdapter'
import { INITIAL_SCHEMA } from '../schema'

export class BunSqliteAdapter implements IDatabaseAdapter {
  private db: Database | null = null
  private dbPath: string

  constructor(dbPath: string = ':memory:') {
    this.dbPath = dbPath
  }

  async init() {
    if (!this.db) {
      this.db = new Database(this.dbPath)
      // Run migrations
      this.db.run(INITIAL_SCHEMA)
    }
  }

  async execute(query: string, values?: unknown[]): Promise<any> {
    if (!this.db) await this.init()
    // bun:sqlite .run() returns { changes: number, lastInsertRowid: number | bigint }
    // properly spread the values array as arguments
    const result = this.db!.run(query, ...((values as any[]) ?? []))
    return {
      rowsAffected: result.changes,
      lastInsertId: result.lastInsertRowid,
    }
  }

  async select<T>(query: string, values?: unknown[]): Promise<T[]> {
    if (!this.db) await this.init()
    // bun:sqlite .query().all() returns T[]
    const queryStmt = this.db!.query(query)
    // properly spread the values array as arguments
    return queryStmt.all(...((values as any[]) ?? [])) as T[]
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
