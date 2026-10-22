import { eq } from 'drizzle-orm'
import { WithAttachments } from '@c/types/index'
import { junctionTags, junctionUrls } from '../schemas'
import { BaseRepository, TableWithId } from './BaseRepository'
import { syncAttachments } from './helpers'

// Repository for entities that carry tags/urls through the junction tables.
// Writes the row and its junctions in one transaction, then returns it hydrated.
export abstract class AttachableRepository<
  TTable extends TableWithId,
  TRead extends TTable['$inferSelect'],
> extends BaseRepository<TTable> {
  abstract getById(id: string): Promise<TRead | null>

  async add(
    entity: WithAttachments<TTable['$inferInsert']>,
  ): Promise<TRead | null> {
    const db = await this.getDb()
    if (!db) return null

    const { tags, urls, ...values } = entity
    const row = db.transaction((tx) => {
      const row = tx
        .insert(this.table)
        .values(values as TTable['$inferInsert'])
        .onConflictDoNothing()
        .returning()
        .get() as TTable['$inferSelect'] | undefined
      if (row) syncAttachments(tx, row.id, { tags, urls })
      return row
    })
    return row ? this.getById(row.id) : null
  }

  async update(
    id: string,
    entity: WithAttachments<Partial<TTable['$inferInsert']>>,
  ): Promise<TRead | null> {
    const db = await this.getDb()
    if (!db) return null

    const { tags, urls, ...values } = entity
    const found = db.transaction((tx) => {
      const exists =
        Object.keys(values).length > 0
          ? tx
              .update(this.table)
              .set(values as Partial<TTable['$inferInsert']>)
              .where(eq(this.table.id, id))
              .returning({ id: this.table.id })
              .get()
          : tx
              .select({ id: this.table.id })
              .from(this.table)
              .where(eq(this.table.id, id))
              .get()
      if (exists) syncAttachments(tx, id, { tags, urls }, { replace: true })
      return !!exists
    })
    return found ? this.getById(id) : null
  }

  async delete(id: string): Promise<TTable['$inferSelect'] | null> {
    const db = await this.getDb()
    if (!db) return null

    // attachedToId has no foreign key, so junction rows are cleaned up here
    return (
      db.transaction((tx) => {
        tx.delete(junctionTags).where(eq(junctionTags.attachedToId, id)).run()
        tx.delete(junctionUrls).where(eq(junctionUrls.attachedToId, id)).run()
        return tx
          .delete(this.table)
          .where(eq(this.table.id, id))
          .returning()
          .get() as TTable['$inferSelect'] | undefined
      }) ?? null
    )
  }
}
