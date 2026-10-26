import { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import { UnHussleDB } from '../UnHussleDB'

export type TableWithId = SQLiteTable & { id: SQLiteColumn }

// Shared database access for entity-specific hydrated reads.
// Mutation handlers obtain synchronous repositories from their unit of work.
export abstract class BaseRepository<TTable extends TableWithId> {
  private db: UnHussleDB['db'] | null = null

  constructor(
    private readonly dbInstance: UnHussleDB,
    protected readonly table: TTable,
  ) {}

  protected async getDb() {
    if (!this.db) {
      this.db = this.dbInstance.isReady() ? await this.dbInstance.getDb() : null
    }
    return this.db
  }
}
