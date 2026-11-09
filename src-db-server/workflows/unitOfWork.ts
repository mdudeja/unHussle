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
    /** Runs units in order in one transaction; resolves to the last non-undefined unit result. */
    async transaction<T>(
      work: Array<TransactionWorkUnit<T>>,
    ): Promise<T | undefined> {
      const db = await database.getDb()

      return db.transaction((tx) => {
        let last: T | undefined
        for (const fn of work) {
          const result = fn({
            tx,
            repository: (table) => transactionRepository(tx, table),
          })

          if (result instanceof Promise)
            throw new Error('SQLite transaction callbacks must be synchronous')

          if (result !== undefined) last = result
        }
        return last
      })
    },
  }
}
