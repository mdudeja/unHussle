import { eq } from 'drizzle-orm'
import type { TableWithId } from '@d/database/repositories/BaseRepository'
import type { SyncTx } from '@d/database/repositories/helpers'
import type { UnHussleDB } from '@d/database/UnHussleDB'

/** These primitives never fetch a database or create a nested transaction. */
export function transactionRepository<T extends TableWithId>(
  tx: SyncTx,
  table: T,
) {
  return {
    insert(values: T['$inferInsert']) {
      return tx
        .insert(table)
        .values(values)
        .onConflictDoNothing()
        .returning()
        .get()
    },
    update(id: string, values: Partial<T['$inferInsert']>) {
      return Object.keys(values).length
        ? tx.update(table).set(values).where(eq(table.id, id)).returning().get()
        : tx.select().from(table).where(eq(table.id, id)).get()
    },
    delete(id: string) {
      return tx.delete(table).where(eq(table.id, id)).returning().get()
    },
    all() {
      return tx.select().from(table).all()
    },
    deleteAll() {
      return tx.delete(table).returning().all()
    },
  }
}

export function createUnitOfWork(database: UnHussleDB) {
  return {
    async transaction<T>(
      work: (context: {
        tx: SyncTx
        repository: <Table extends TableWithId>(
          table: Table,
        ) => ReturnType<typeof transactionRepository<Table>>
      }) => T,
    ): Promise<T> {
      const db = await database.getDb()
      return db.transaction((tx) => {
        const result = work({
          tx,
          repository: (table) => transactionRepository(tx, table),
        })
        if (result instanceof Promise)
          throw new Error('SQLite transaction callbacks must be synchronous')
        return result
      })
    },
  }
}
