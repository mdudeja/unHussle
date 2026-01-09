import Database from '@tauri-apps/plugin-sql'
import { IDatabaseAdapter } from './IDatabaseAdapter'
import { INITIAL_SCHEMA } from '../schema'

export class TauriSqlAdapter implements IDatabaseAdapter {
  private db: Database | null = null
  private dbName: string

  constructor(dbName: string = 'sqlite:unhussle.db') {
    this.dbName = dbName
  }

  async init() {
    if (!this.db) {
      this.db = await Database.load(this.dbName)
      await this.db.execute(INITIAL_SCHEMA)
    }
  }

  async execute(query: string, values?: unknown[]): Promise<any> {
    if (!this.db) await this.init()
    return await this.db!.execute(query, values)
  }

  async select<T>(query: string, values?: unknown[]): Promise<T[]> {
    if (!this.db) await this.init()
    return await this.db!.select<T[]>(query, values)
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close()
      this.db = null
    }
  }
}
