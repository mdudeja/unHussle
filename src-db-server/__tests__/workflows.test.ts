import { beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { createBackendRuntime } from '@d/workflows/runtime'
import { createUnitOfWork } from '@d/workflows/unitOfWork'
import { tasks, tags, junctionTags, junctionUrls } from '@d/database/schemas'
import type { EntryRecord } from '@c/workflows/contracts'

describe('Transactional command handlers', () => {
  const database = new UnHussleDB(':memory:')
  beforeAll(async () => {
    await database.getDb()
  })

  test('attachment failure rolls back owner and new tags and emits no completion', async () => {
    const runtime = createBackendRuntime(database)
    const db = await database.getDb()
    let events = 0
    runtime.events.on('entry.changed', () => {
      events++
    })
    await expect(
      runtime.commands.execute('entry.mutate', {
        kind: 'tasks',
        action: 'create',
        changes: {
          title: 'Must roll back',
          tags: [{ title: 'rollback_tag' }],
          urls: [{ url: 'invalid' }],
        },
      }),
    ).rejects.toThrow()
    expect(
      db.select().from(tasks).where(eq(tasks.title, 'Must roll back')).all(),
    ).toEqual([])
    expect(
      db.select().from(tags).where(eq(tags.title, 'rollback_tag')).all(),
    ).toEqual([])
    expect(events).toBe(0)
    runtime.dispose()
  })

  test('completion is after commit and listener failure cannot fail a committed write', async () => {
    const runtime = createBackendRuntime(database)
    const db = await database.getDb()
    let committed = false
    let count = 0
    runtime.events.on('entry.changed', (event) => {
      count++
      committed = !!db
        .select()
        .from(tasks)
        .where(eq(tasks.id, (event.result as EntryRecord).id))
        .get()
      throw new Error('Independent listener failed')
    })
    const result = (await runtime.commands.execute('entry.mutate', {
      kind: 'tasks',
      action: 'create',
      changes: { title: 'Committed' },
    })) as EntryRecord
    expect(result.id).toBeTruthy()
    expect(committed).toBe(true)
    expect(count).toBe(1)
    runtime.dispose()
  })

  test('bulk deletion cleans junctions and preserves shared attachment records', async () => {
    const runtime = createBackendRuntime(database)
    const db = await database.getDb()
    await runtime.commands.execute('entry.mutate', {
      kind: 'tasks',
      action: 'create',
      changes: {
        title: 'Bulk owner',
        tags: [{ title: 'bulk_shared' }],
        urls: [{ url: 'https://bulk.example' }],
      },
    })
    const result = await runtime.commands.execute('entry.mutate', {
      kind: 'tasks',
      action: 'deleteAll',
    })
    expect(result.deleted).toBeGreaterThan(0)
    expect(db.select().from(junctionTags).all()).toEqual([])
    expect(db.select().from(junctionUrls).all()).toEqual([])
    expect(
      db.select().from(tags).where(eq(tags.title, 'bulk_shared')).all(),
    ).toHaveLength(1)
    runtime.dispose()
  })

  test('tag deletion cleans referencing junctions without deleting the owner', async () => {
    const runtime = createBackendRuntime(database)
    const db = await database.getDb()
    const owner = (await runtime.commands.execute('entry.mutate', {
      kind: 'tasks',
      action: 'create',
      changes: {
        title: 'Surviving owner',
        tags: [{ title: 'delete_reference' }],
      },
    })) as EntryRecord
    const tag = db
      .select()
      .from(tags)
      .where(eq(tags.title, 'delete_reference'))
      .get()!
    await runtime.commands.execute('entry.mutate', {
      kind: 'tags',
      action: 'delete',
      id: tag.id,
    })
    expect(
      db
        .select()
        .from(junctionTags)
        .where(eq(junctionTags.attachedToId, owner.id))
        .all(),
    ).toEqual([])
    expect(
      db.select().from(tasks).where(eq(tasks.id, owner.id)).get(),
    ).toBeTruthy()
    runtime.dispose()
  })

  test('unsupported attachment capability is rejected before any write', async () => {
    const runtime = createBackendRuntime(database)
    await expect(
      runtime.commands.execute('entry.mutate', {
        kind: 'resources',
        action: 'create',
        changes: {
          title: 'Unsupported',
          tags: [{ title: 'ignored_before' }],
        },
      }),
    ).rejects.toThrow('Supporters are not supported for resources')
    runtime.dispose()
  })

  test('unit of work rejects async transaction callbacks', async () => {
    await expect(
      createUnitOfWork(database).transaction(async () => 1),
    ).rejects.toThrow('must be synchronous')
  })
})
