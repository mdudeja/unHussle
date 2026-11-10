import { eq } from 'drizzle-orm'
import type { TableWithId } from '@d/database/repositories/BaseRepository'
import type { SyncTx } from '@d/database/repositories/helpers'
import type { UnHussleDB } from '@d/database/UnHussleDB'
import type { TransactionWorkUnit } from '@d/workflows/contracts'

/** These primitives never fetch a database or create a nested transaction. */
export function transactionRepository<T extends TableWithId>(
  tx: SyncTx,
  table: T,
) {
  return {
    /** Inserts a new record into the table, ignoring the insert if it conflicts with an existing record. */
    insert(values: T['$inferInsert']) {
      return tx
        .insert(table)
        .values(values)
        .onConflictDoNothing()
        .returning()
        .get()
    },
    /** Updates an existing record with the given values. */
    update(id: string, values: Partial<T['$inferInsert']>) {
      return Object.keys(values).length
        ? tx.update(table).set(values).where(eq(table.id, id)).returning().get()
        : tx.select().from(table).where(eq(table.id, id)).get()
    },
    /** Deletes the record matching the given ID and returns the deleted record. */
    delete(id: string) {
      return tx.delete(table).where(eq(table.id, id)).returning().get()
    },
    /** Retrieves all records from the table. */
    all() {
      return tx.select().from(table).all()
    },
    /** Deletes all records from the table and returns the deleted rows. */
    deleteAll() {
      return tx.delete(table).returning().all()
    },
  }
}

/** Provides a unit-of-work abstraction for running synchronous database work atomically within a single transaction. */
export function createUnitOfWork(database: UnHussleDB) {
  return {
    /** One compiled composition, one synchronous transaction, one explicit result. */
    async transaction<T>(work: TransactionWorkUnit<T>): Promise<T> {
      const db = await database.getDb()
      return db.transaction((tx) => {
        const result = work({
          tx,
          repository: (table) => transactionRepository(tx, table),
        })
        if (result && typeof (result as { then?: unknown }).then === 'function')
          throw new Error('SQLite transaction callbacks must be synchronous')
        return result
      })
    },
  }
}
