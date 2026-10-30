import { beforeAll, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { createBackendRuntime } from '@d/workflows/runtime'
import { createUnitOfWork } from '@d/workflows/unitOfWork'
import {
  tasks,
  tags,
  urls,
  projects,
  junctionTags,
  junctionUrls,
} from '@d/database/schemas'
import type { EntryRecord, MutationEvent } from '@c/workflows/contracts'

describe('Transactional command handlers', () => {
  const database = new UnHussleDB(':memory:')
  beforeAll(async () => {
    await database.getDb()
  })

  test('attachment failure rolls back owner and new tags and emits no completion', async () => {
    const runtime = createBackendRuntime(database)
    const db = await database.getDb()
    let events = 0
    runtime.events.on('entity.add', () => {
      events++
    })
    await expect(
      runtime.commands.execute('entity.add', {
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
    runtime.events.on('entity.add', (_name, event) => {
      count++
      committed = !!db
        .select()
        .from(tasks)
        .where(eq(tasks.id, (event.result as EntryRecord).id))
        .get()
      throw new Error('Independent listener failed')
    })
    const result = (await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: { title: 'Committed' },
    })) as EntryRecord
    expect(result.id).toBeTruthy()
    expect(committed).toBe(true)
    expect(count).toBe(1)
    runtime.dispose()
  })

  test('the created row id is carried into supporter sync', async () => {
    const runtime = createBackendRuntime(database)
    const db = await database.getDb()
    const task = (await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: { title: 'Carried id', tags: [{ title: '#Carried' }] },
    })) as EntryRecord
    const tag = db.select().from(tags).where(eq(tags.title, 'carried')).get()!
    expect(
      db
        .select()
        .from(junctionTags)
        .where(eq(junctionTags.attachedToId, task.id))
        .all()
        .map((row) => row.refId),
    ).toEqual([tag.id])
    runtime.dispose()
  })

  test('bulk deletion returns rows, cleans junctions and preserves shared attachment records', async () => {
    const runtime = createBackendRuntime(database)
    const db = await database.getDb()
    await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: {
        title: 'Bulk owner',
        tags: [{ title: 'bulk_shared' }],
        urls: [{ url: 'https://bulk.example' }],
      },
    })
    const result = await runtime.commands.execute('entity.deleteAll', {
      kind: 'tasks',
      action: 'deleteAll',
    })
    expect(Array.isArray(result)).toBe(true)
    expect((result as EntryRecord[]).length).toBeGreaterThan(0)
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
    const owner = (await runtime.commands.execute('entity.add', {
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
    await runtime.commands.execute('entitySupporter.delete', {
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

  test('deleting a missing row fails with NOT_FOUND', async () => {
    const runtime = createBackendRuntime(database)
    await expect(
      runtime.commands.execute('entity.delete', {
        kind: 'tasks',
        action: 'delete',
        id: 'missing',
      }),
    ).rejects.toThrow('NOT_FOUND')
    runtime.dispose()
  })

  test('unsupported attachment capability is rejected before any write', async () => {
    const runtime = createBackendRuntime(database)
    const db = await database.getDb()
    await expect(
      runtime.commands.execute('entity.add', {
        kind: 'resources',
        action: 'create',
        changes: {
          title: 'Unsupported',
          tags: [{ title: 'ignored_before' }],
        },
      }),
    ).rejects.toThrow('Provided Supporters are not supported for resources')
    expect(
      db.select().from(tags).where(eq(tags.title, 'ignored_before')).all(),
    ).toEqual([])
    runtime.dispose()
  })

  test('supporter counts follow junction changes', async () => {
    const runtime = createBackendRuntime(database)
    const db = await database.getDb()
    const countsOf = (title: string) =>
      db
        .select({
          count_tasks: tags.count_tasks,
          count_resources: tags.count_resources,
          count_pga: tags.count_pga,
        })
        .from(tags)
        .where(eq(tags.title, title))
        .get()

    const first = (await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: { title: 'Count A', tags: [{ title: 'counted' }] },
    })) as EntryRecord
    await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: { title: 'Count B', tags: [{ title: 'counted' }] },
    })
    await runtime.commands.execute('entityCollection.add', {
      kind: 'projects',
      action: 'create',
      changes: { title: 'Count project', tags: [{ title: 'counted' }] },
    })
    expect(countsOf('counted')).toEqual({
      count_tasks: 2,
      count_resources: 0,
      count_pga: 1,
    })

    // Replace-sync drops the tag from the first task.
    await runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id: first.id,
      changes: { tags: [] },
    })
    expect(countsOf('counted')?.count_tasks).toBe(1)

    await runtime.commands.execute('entity.delete', {
      kind: 'tasks',
      action: 'delete',
      id: first.id,
    })
    await runtime.commands.execute('entity.deleteAll', {
      kind: 'tasks',
      action: 'deleteAll',
    })
    expect(countsOf('counted')).toEqual({
      count_tasks: 0,
      count_resources: 0,
      count_pga: 1,
    })

    const url = db.select().from(urls).all()
    expect(url.every((row) => row.count_tasks === 0)).toBe(true)
    runtime.dispose()
  })

  test('collection counts follow entity foreign keys', async () => {
    const runtime = createBackendRuntime(database)
    const db = await database.getDb()
    const project = (await runtime.commands.execute('entityCollection.add', {
      kind: 'projects',
      action: 'create',
      changes: { title: 'Collection counts' },
    })) as EntryRecord
    const other = (await runtime.commands.execute('entityCollection.add', {
      kind: 'projects',
      action: 'create',
      changes: { title: 'Collection counts other' },
    })) as EntryRecord
    const countsOf = (id: string) =>
      db
        .select({
          count_tasks: projects.count_tasks,
          count_resources: projects.count_resources,
        })
        .from(projects)
        .where(eq(projects.id, id))
        .get()

    const task = (await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: { title: 'Member task', project_id: project.id },
    })) as EntryRecord
    await runtime.commands.execute('entity.add', {
      kind: 'resources',
      action: 'create',
      changes: { title: 'Member resource', project_id: project.id },
    })
    expect(countsOf(project.id)).toEqual({ count_tasks: 1, count_resources: 1 })

    await runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id: task.id,
      changes: { project_id: other.id },
    })
    expect(countsOf(project.id)).toEqual({ count_tasks: 0, count_resources: 1 })
    expect(countsOf(other.id)).toEqual({ count_tasks: 1, count_resources: 0 })

    // Counts are derived; client-supplied values are ignored.
    await runtime.commands.execute('entityCollection.change', {
      kind: 'projects',
      action: 'update',
      id: other.id,
      changes: { count_tasks: 99 },
    })
    expect(countsOf(other.id)?.count_tasks).toBe(1)
    runtime.dispose()
  })

  test('collection deletion announces member entities after commit', async () => {
    const runtime = createBackendRuntime(database)
    const project = (await runtime.commands.execute('entityCollection.add', {
      kind: 'projects',
      action: 'create',
      changes: { title: 'Announcing project' },
    })) as EntryRecord
    const task = (await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: { title: 'Announced task', project_id: project.id },
    })) as EntryRecord

    const announced: MutationEvent[] = []
    runtime.events.on('tasks.change', (_name, event) => {
      announced.push(event)
    })
    runtime.events.on('resources.change', (_name, event) => {
      announced.push(event)
    })
    await runtime.commands.execute('entityCollection.delete', {
      kind: 'projects',
      action: 'delete',
      id: project.id,
    })
    expect(announced).toHaveLength(1)
    expect(announced[0]).toMatchObject({
      kind: 'tasks',
      action: 'update',
      attachedIds: [task.id],
    })
    runtime.dispose()
  })

  test('area deletion detaches and announces member projects, goals and tasks', async () => {
    const runtime = createBackendRuntime(database)
    const db = await database.getDb()
    const area = (await runtime.commands.execute('entityCollection.add', {
      kind: 'areas',
      action: 'create',
      changes: { title: 'Announcing area' },
    })) as EntryRecord
    const project = (await runtime.commands.execute('entityCollection.add', {
      kind: 'projects',
      action: 'create',
      changes: { title: 'Area project', area_id: area.id },
    })) as EntryRecord
    const goal = (await runtime.commands.execute('entityCollection.add', {
      kind: 'goals',
      action: 'create',
      changes: { title: 'Area goal', area_id: area.id },
    })) as EntryRecord
    const task = (await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: { title: 'Area task', area_id: area.id },
    })) as EntryRecord

    const announced: MutationEvent[] = []
    for (const name of [
      'tasks.change',
      'resources.change',
      'projects.change',
      'goals.change',
    ] as const)
      runtime.events.on(name, (_name, event) => {
        announced.push(event)
      })

    await runtime.commands.execute('entityCollection.delete', {
      kind: 'areas',
      action: 'delete',
      id: area.id,
    })

    expect(
      Object.fromEntries(announced.map((e) => [e.kind, e.attachedIds])),
    ).toEqual({
      tasks: [task.id],
      projects: [project.id],
      goals: [goal.id],
    })
    expect(
      db.select().from(projects).where(eq(projects.id, project.id)).get()
        ?.area_id,
    ).toBeNull()
    runtime.dispose()
  })

  test('unit of work rejects async transaction callbacks', async () => {
    await expect(
      createUnitOfWork(database).transaction([async () => 1]),
    ).rejects.toThrow('must be synchronous')
  })
})
