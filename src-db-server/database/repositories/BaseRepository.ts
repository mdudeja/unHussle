import { eq } from 'drizzle-orm'
import { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import { UnHussleDB } from '../UnHussleDB'

type TableWithId = SQLiteTable & { id: SQLiteColumn }

// Shared db access and write methods; read methods stay in each repository
// since they depend on the entity's relations and searchable columns.
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

  async add(
    entity: TTable['$inferInsert'],
  ): Promise<TTable['$inferSelect'] | null> {
    const db = await this.getDb()
    const rows = await db
      ?.insert(this.table)
      .values(entity)
      .onConflictDoNothing()
      .returning()
    return rows?.[0] ?? null
  }

  async update(
    id: string,
    entity: Partial<TTable['$inferInsert']>,
  ): Promise<TTable['$inferSelect'] | null> {
    const db = await this.getDb()
    const rows = await db
      ?.update(this.table)
      .set(entity)
      .where(eq(this.table.id, id))
      .returning()
    return rows?.[0] ?? null
  }

  async delete(id: string): Promise<TTable['$inferSelect'] | null> {
    const db = await this.getDb()
    const rows = await db
      ?.delete(this.table)
      .where(eq(this.table.id, id))
      .returning()
    return rows?.[0] ?? null
  }

  async deleteAll(): Promise<number> {
    const db = await this.getDb()
    const rows = await db?.delete(this.table).returning()
    return rows?.length ?? 0
  }
}
