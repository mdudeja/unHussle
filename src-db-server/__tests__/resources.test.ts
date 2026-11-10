import { afterAll, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { createBackendRuntime } from '@d/workflows/runtime'
import { junctionResources, projects, resources } from '@d/database/schemas'
import { ResourcesRepository } from '@d/database/repositories/resources'
import { ProjectsRepository } from '@d/database/repositories/projects'
import { getTaskContext } from '@d/database/repositories/taskContext'
import { readSchedulerTasks } from '@d/database/repositories/scheduler'
import { readSettings } from '@d/workflows/scheduler'
import { hashContent, VaultConflict, VaultError } from '@d/vault/vault'
import type { EntryRecord, MutationEvent } from '@c/workflows/contracts'
import { createTelemetry } from '@c/workflows/telemetry'
import { slugify } from '@c/slug'

const tempDirs: string[] = []
/** Creates a temporary directory and records it for later cleanup. */
const tempDir = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

/**
 * Runs `work` with an action appended to `command` that throws for
 * resources, so the transaction fails after the file was written or moved.
 */
async function failingAfterFiles(
  runtime: ReturnType<typeof createBackendRuntime>,
  command: string,
  work: () => Promise<unknown>,
) {
  const original = runtime.compositions.definition(command)
  const rowStep = original.steps.find((step) =>
    /\.(createRow|updateRow|deleteRow|deleteAllRows)$/.test(step.action ?? ''),
  )!
  runtime.compositions.replaceCommand({
    ...original,
    steps: [
      ...original.steps,
      {
        id: 'failAfterFiles',
        action: 'kernel.mutation.announceAffectedEntities',
        input: { from: 'step', step: rowStep.id, path: ['input'] },
      },
    ],
  })
  try {
    await expect(work()).rejects.toThrow('only supported for collections')
  } finally {
    runtime.compositions.replaceCommand(original)
  }
}

/** A fresh in-memory DB with its own vault folder. */
async function setup() {
  const database = new UnHussleDB(':memory:')
  const db = await database.getDb()
  const vaultDir = tempDir('vault-')
  const telemetry = createTelemetry({ side: 'backend' })
  const runtime = createBackendRuntime(database, { vaultDir, telemetry })
  const events: [string, unknown][] = []
  runtime.events.onAny((name, payload) => {
    events.push([name, payload])
  })
  /** Retrieves a resource record by its unique identifier. */
  const row = (id: string) =>
    db.select().from(resources).where(eq(resources.id, id)).get()
  /** Resolves a path relative to the vault directory. */
  const file = (rel: string) => join(vaultDir, rel)
  /** Adds a new resource entity using the provided changes. */
  const addResource = async (changes: Record<string, unknown>) =>
    (await runtime.commands.execute('entity.add', {
      kind: 'resources',
      action: 'create',
      changes,
    })) as EntryRecord
  /** Adds a new project to the project collection. */
  const addProject = async (title: string) =>
    (await runtime.commands.execute('entityCollection.add', {
      kind: 'projects',
      action: 'create',
      changes: { title },
    })) as EntryRecord
  return {
    database,
    db,
    vaultDir,
    runtime,
    telemetry,
    events,
    row,
    file,
    addResource,
    addProject,
  }
}

describe('slugify', () => {
  test('makes file-name-safe slugs', () => {
    expect(slugify('Q3 Plan')).toBe('q3-plan')
    expect(slugify('  Crème brûlée / notes!  ')).toBe('creme-brulee-notes')
    expect(slugify('???')).toBe('untitled')
    expect(slugify('CON')).toBe('con-file')
    expect(slugify('x'.repeat(200))).toHaveLength(80)
  })
})

describe('Resource files', () => {
  test('creating a resource writes an empty file named after its title', async () => {
    const f = await setup()
    const resource = await f.addResource({ title: 'Q3 Plan' })
    expect(f.row(resource.id)).toMatchObject({
      file_path: 'q3-plan.md',
      content_hash: hashContent(''),
    })
    expect(readFileSync(f.file('q3-plan.md'), 'utf8')).toBe('')
    f.runtime.dispose()
  })

  test('slug collisions and unindexed files get a numbered name', async () => {
    const f = await setup()
    writeFileSync(f.file('notes.md'), 'someone else’s file')
    const first = await f.addResource({ title: 'Notes' })
    const second = await f.addResource({ title: 'notes!' })
    expect(f.row(first.id)?.file_path).toBe('notes-2.md')
    expect(f.row(second.id)?.file_path).toBe('notes-3.md')
    expect(readFileSync(f.file('notes.md'), 'utf8')).toBe('someone else’s file')
    f.runtime.dispose()
  })

  test('clients cannot set the file path or hash', async () => {
    const f = await setup()
    const resource = await f.addResource({
      title: 'Safe',
      file_path: '../../escape.md',
      content_hash: 'forged',
    })
    expect(f.row(resource.id)).toMatchObject({
      file_path: 'safe.md',
      content_hash: hashContent(''),
    })
    f.runtime.dispose()
  })

  test('a failed create removes the file it wrote', async () => {
    const f = await setup()
    await failingAfterFiles(f.runtime, 'entity.add', () =>
      f.addResource({ title: 'Rolled back' }),
    )
    expect(f.db.select().from(resources).all()).toEqual([])
    expect(existsSync(f.file('rolled-back.md'))).toBe(false)
    f.runtime.dispose()
  })

  test('renaming moves the file, and a failed rename moves it back', async () => {
    const f = await setup()
    const resource = await f.addResource({ title: 'Draft' })
    writeFileSync(f.file('draft.md'), '# Draft')

    await f.runtime.commands.execute('entity.change', {
      kind: 'resources',
      action: 'update',
      id: resource.id,
      changes: { title: 'Final copy' },
    })
    expect(f.row(resource.id)?.file_path).toBe('final-copy.md')
    expect(readFileSync(f.file('final-copy.md'), 'utf8')).toBe('# Draft')
    expect(existsSync(f.file('draft.md'))).toBe(false)

    await failingAfterFiles(f.runtime, 'entity.change', () =>
      f.runtime.commands.execute('entity.change', {
        kind: 'resources',
        action: 'update',
        id: resource.id,
        changes: { title: 'Never saved' },
      }),
    )
    expect(f.row(resource.id)).toMatchObject({
      title: 'Final copy',
      file_path: 'final-copy.md',
    })
    expect(readFileSync(f.file('final-copy.md'), 'utf8')).toBe('# Draft')
    expect(existsSync(f.file('never-saved.md'))).toBe(false)
    f.runtime.dispose()
  })

  test('a failed delete restores the trashed file', async () => {
    const f = await setup()
    const resource = await f.addResource({ title: 'Restored' })
    await failingAfterFiles(f.runtime, 'entity.delete', () =>
      f.runtime.commands.execute('entity.delete', {
        kind: 'resources',
        action: 'delete',
        id: resource.id,
      }),
    )
    expect(f.row(resource.id)).toBeDefined()
    expect(existsSync(f.file('restored.md'))).toBe(true)
    expect(readdirSync(f.file('.trash'))).toEqual([])
    f.runtime.dispose()
  })

  test('renaming to a taken title is rejected without moving files', async () => {
    const f = await setup()
    const resource = await f.addResource({ title: 'Kept' })
    const other = await f.addResource({ title: 'Taken' })
    await expect(
      f.runtime.commands.execute('entity.change', {
        kind: 'resources',
        action: 'update',
        id: resource.id,
        changes: { title: 'Taken' },
      }),
    ).rejects.toThrow('UNIQUE constraint failed')
    expect(f.row(resource.id)?.file_path).toBe('kept.md')
    expect(f.row(other.id)?.file_path).toBe('taken.md')
    expect(existsSync(f.file('kept.md'))).toBe(true)
    f.runtime.dispose()
  })

  test('deleting moves files to .trash, and links cascade', async () => {
    const f = await setup()
    const project = await f.addProject('Trash project')
    const resource = await f.addResource({
      title: 'Old notes',
      links: [{ kind: 'projects', id: project.id }],
    })
    await f.addResource({ title: 'Other notes' })

    await f.runtime.commands.execute('entity.delete', {
      kind: 'resources',
      action: 'delete',
      id: resource.id,
    })
    expect(existsSync(f.file('old-notes.md'))).toBe(false)
    const trashed = readdirSync(f.file('.trash'))
    expect(trashed).toHaveLength(1)
    expect(trashed[0]).toStartWith('old-notes-')
    expect(f.db.select().from(junctionResources).all()).toEqual([])
    expect(
      f.db
        .select({ count: projects.count_resources })
        .from(projects)
        .where(eq(projects.id, project.id))
        .get()?.count,
    ).toBe(0)

    await f.runtime.commands.execute('entity.deleteAll', {
      kind: 'resources',
      action: 'deleteAll',
    })
    expect(existsSync(f.file('other-notes.md'))).toBe(false)
    expect(readdirSync(f.file('.trash'))).toHaveLength(2)
    f.runtime.dispose()
  })

  test('a delete of a missing resource leaves the files alone', async () => {
    const f = await setup()
    await f.addResource({ title: 'Stays' })
    await expect(
      f.runtime.commands.execute('entity.delete', {
        kind: 'resources',
        action: 'delete',
        id: 'missing',
      }),
    ).rejects.toThrow('NOT_FOUND')
    expect(existsSync(f.file('stays.md'))).toBe(true)
    f.runtime.dispose()
  })
})

describe('Resource content', () => {
  test('saving writes the file, stores its hash and announces only the id', async () => {
    const f = await setup()
    const resource = await f.addResource({ title: 'Secret plan' })
    f.events.length = 0
    f.telemetry.clear()

    const content = '# Secret plan\n\nTop secret body'
    const saved = await f.runtime.commands.execute('resource.content.save', {
      id: resource.id,
      content,
      baseHash: hashContent(''),
      operationId: 'save-1',
    })
    expect(saved.content_hash).toBe(hashContent(content))
    expect(readFileSync(f.file('secret-plan.md'), 'utf8')).toBe(content)
    expect(f.row(resource.id)?.content_hash).toBe(hashContent(content))

    expect(f.events).toEqual([
      ['resource.content.changed', { operationId: 'save-1', id: resource.id }],
    ])
    // Content never reaches events or telemetry.
    const spans = JSON.stringify(f.telemetry.recent())
    expect(spans).not.toContain('Top secret body')
    expect(JSON.stringify(f.events)).not.toContain('Top secret body')
    f.runtime.dispose()
  })

  test('an edit made outside the app is a conflict unless forced', async () => {
    const f = await setup()
    const resource = await f.addResource({ title: 'Shared' })
    const baseHash = hashContent('')
    writeFileSync(f.file('shared.md'), 'edited in another editor')

    /** Saves the current resource content. */
    const save = (force?: boolean) =>
      f.runtime.commands.execute('resource.content.save', {
        id: resource.id,
        content: 'mine',
        baseHash,
        force,
      })
    await expect(save()).rejects.toBeInstanceOf(VaultConflict)
    expect(readFileSync(f.file('shared.md'), 'utf8')).toBe(
      'edited in another editor',
    )

    await save(true)
    expect(readFileSync(f.file('shared.md'), 'utf8')).toBe('mine')
    f.runtime.dispose()
  })

  test('a missing file is reported and recreated by the next save', async () => {
    const f = await setup()
    const repository = new ResourcesRepository(f.database, () => f.vaultDir)
    const resource = await f.addResource({ title: 'Lost' })
    rmSync(f.file('lost.md'))

    expect((await repository.getById(resource.id))?.missing).toBe(true)
    await f.runtime.commands.execute('resource.content.save', {
      id: resource.id,
      content: 'back again',
      baseHash: null,
    })
    expect(readFileSync(f.file('lost.md'), 'utf8')).toBe('back again')
    expect((await repository.getById(resource.id))?.missing).toBe(false)
    f.runtime.dispose()
  })

  test('saving an unknown resource fails', async () => {
    const f = await setup()
    await expect(
      f.runtime.commands.execute('resource.content.save', {
        id: 'missing',
        content: 'x',
      }),
    ).rejects.toThrow('NOT_FOUND')
    f.runtime.dispose()
  })
})

describe('Vault rescan', () => {
  test('imports new files, skips .trash and is idempotent', async () => {
    const f = await setup()
    await f.addResource({ title: 'Known' })
    mkdirSync(f.file('notes'), { recursive: true })
    writeFileSync(f.file('notes/new-idea.md'), 'intro\n# Big Idea\nbody')
    writeFileSync(f.file('plain_file-name.md'), 'no heading')
    writeFileSync(f.file('known-copy.md'), '# Known')
    writeFileSync(f.file('ignored.txt'), 'not markdown')
    mkdirSync(f.file('.trash'), { recursive: true })
    writeFileSync(f.file('.trash/old.md'), '# Old')

    const result = await f.runtime.commands.execute('vault.rescan', {})
    expect(result).toEqual({ imported: 3, repaired: 0, missing: [] })
    const byPath = Object.fromEntries(
      f.db
        .select()
        .from(resources)
        .all()
        .map((row) => [row.file_path, row.title]),
    )
    expect(byPath).toEqual({
      'known.md': 'Known',
      'notes/new-idea.md': 'Big Idea',
      'plain_file-name.md': 'plain file name',
      'known-copy.md': 'Known (2)',
    })

    expect(await f.runtime.commands.execute('vault.rescan', {})).toEqual({
      imported: 0,
      repaired: 0,
      missing: [],
    })
    f.runtime.dispose()
  })

  test('relinks a file renamed outside a committed command, and reports missing ones', async () => {
    const f = await setup()
    const renamed = await f.addResource({ title: 'Renamed' })
    const gone = await f.addResource({ title: 'Gone' })
    // The row still points at an old path; the file sits at the title's slug.
    f.db
      .update(resources)
      .set({ file_path: 'old-name.md' })
      .where(eq(resources.id, renamed.id))
      .run()
    rmSync(f.file('gone.md'))
    // A row from before files existed has no path at all.
    const [legacy] = f.db
      .insert(resources)
      .values({ title: 'Legacy' })
      .returning()
      .all()

    const result = await f.runtime.commands.execute('vault.rescan', {})
    expect(result).toEqual({ imported: 0, repaired: 2, missing: ['Gone'] })
    expect(f.row(renamed.id)?.file_path).toBe('renamed.md')
    expect(f.row(legacy.id)?.file_path).toBe('legacy.md')
    expect(existsSync(f.file('legacy.md'))).toBe(true)
    expect(f.row(gone.id)?.file_path).toBe('gone.md')
    f.runtime.dispose()
  })
})

describe('Vault folder', () => {
  test('moving copies files to an empty folder and uses it afterwards', async () => {
    const f = await setup()
    await f.addResource({ title: 'Moving' })
    writeFileSync(f.file('moving.md'), '# Moving')
    const target = join(tempDir('vault-target-'), 'vault')

    const info = await f.runtime.commands.execute('vault.settings.change', {
      path: target,
    })
    expect(info).toMatchObject({
      path: target,
      source: 'custom',
      resources: 1,
      missing: 0,
    })
    expect(readFileSync(join(target, 'moving.md'), 'utf8')).toBe('# Moving')
    expect(existsSync(f.file('moving.md'))).toBe(false)

    await f.addResource({ title: 'After move' })
    expect(existsSync(join(target, 'after-move.md'))).toBe(true)
    f.runtime.dispose()
  })

  test('a non-empty, relative or nested target is rejected', async () => {
    const f = await setup()
    await f.addResource({ title: 'Stay put' })
    const busy = tempDir('vault-busy-')
    writeFileSync(join(busy, 'other.txt'), 'x')
    /** Changes the vault settings to the specified path. */
    const change = (path: string) =>
      f.runtime.commands.execute('vault.settings.change', { path })

    await expect(change(busy)).rejects.toBeInstanceOf(VaultError)
    await expect(change('relative/vault')).rejects.toBeInstanceOf(VaultError)
    await expect(change(join(f.vaultDir, 'inner'))).rejects.toBeInstanceOf(
      VaultError,
    )
    expect(existsSync(f.file('stay-put.md'))).toBe(true)
    expect(f.runtime.vault.rootOf(f.db).source).toBe('default')
    f.runtime.dispose()
  })
})

describe('Resource links', () => {
  test('links are set from either side and announce the other side', async () => {
    const f = await setup()
    const project = await f.addProject('Linked project')
    const task = (await f.runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: { title: 'Linked task' },
    })) as EntryRecord
    const resource = await f.addResource({ title: 'Shared doc' })
    /** Identifies change events that announce newly attached IDs. */
    const announced = () =>
      f.events
        .filter(
          ([name, payload]) =>
            name.endsWith('.change') &&
            !(payload as MutationEvent).result &&
            (payload as MutationEvent).attachedIds,
        )
        .map(([name, payload]) => [
          name,
          (payload as MutationEvent).attachedIds,
        ])

    // Owner side
    f.events.length = 0
    await f.runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id: task.id,
      changes: { resources: [{ id: resource.id }] },
    })
    expect(announced()).toEqual([['resources.change', [resource.id]]])

    // Resource side, replacing its links
    f.events.length = 0
    await f.runtime.commands.execute('entity.change', {
      kind: 'resources',
      action: 'update',
      id: resource.id,
      changes: { links: [{ kind: 'projects', id: project.id }] },
    })
    expect(announced()).toEqual([
      ['tasks.change', [task.id]],
      ['projects.change', [project.id]],
    ])

    const hydrated = await new ResourcesRepository(f.database).getById(
      resource.id,
    )
    expect(hydrated?.links).toEqual([
      { kind: 'projects', id: project.id, title: 'Linked project' },
    ])
    const owner = await new ProjectsRepository(f.database).getById(project.id)
    expect(owner?.resources?.map((row) => row.id)).toEqual([resource.id])
    expect(owner?.count_resources).toBe(1)
    f.runtime.dispose()
  })

  test('deleting an owner removes its links and announces the resources', async () => {
    const f = await setup()
    const resource = await f.addResource({ title: 'Orphaned' })
    const project = (await f.runtime.commands.execute('entityCollection.add', {
      kind: 'projects',
      action: 'create',
      changes: { title: 'Doomed', resources: [{ id: resource.id }] },
    })) as EntryRecord
    f.events.length = 0

    await f.runtime.commands.execute('entityCollection.delete', {
      kind: 'projects',
      action: 'delete',
      id: project.id,
    })
    expect(f.db.select().from(junctionResources).all()).toEqual([])
    expect(
      f.events.find(([name]) => name === 'resources.change')?.[1],
    ).toMatchObject({ attachedIds: [resource.id] })
    f.runtime.dispose()
  })

  test('unknown ids and keys on the wrong kind are rejected', async () => {
    const f = await setup()
    const resource = await f.addResource({ title: 'Picky' })
    await expect(
      f.addProject('unused').then((project) =>
        f.runtime.commands.execute('entityCollection.change', {
          kind: 'projects',
          action: 'update',
          id: project.id,
          changes: { resources: [{ id: 'missing' }] },
        }),
      ),
    ).rejects.toThrow('Resource not found')
    await expect(
      f.runtime.commands.execute('entity.change', {
        kind: 'resources',
        action: 'update',
        id: resource.id,
        changes: { resources: [{ id: resource.id }] },
      }),
    ).rejects.toThrow('Provided Supporters are not supported for resources')
    await expect(
      f.runtime.commands.execute('entity.add', {
        kind: 'tasks',
        action: 'create',
        changes: { title: 'Bad links', links: [] },
      }),
    ).rejects.toThrow('Links are only supported for resources')
    f.runtime.dispose()
  })

  test('resources keep their own tags', async () => {
    const f = await setup()
    const resource = await f.addResource({
      title: 'Tagged doc',
      tags: [{ title: '#Reading' }],
    })
    const hydrated = await new ResourcesRepository(f.database).getById(
      resource.id,
    )
    expect(hydrated?.tags?.map((tag) => tag.title)).toEqual(['reading'])
    f.runtime.dispose()
  })
})

describe('Task context', () => {
  test('a task inherits resources, links and tags from its whole chain', async () => {
    const f = await setup()
    /** Creates a new entry of the specified kind using the runtime command system. */
    const add = async (
      command: 'entity.add' | 'entityCollection.add',
      kind: 'tasks' | 'projects' | 'areas' | 'goals' | 'resources',
      changes: Record<string, unknown>,
    ) =>
      (await f.runtime.commands.execute(command, {
        kind,
        action: 'create',
        changes,
      })) as EntryRecord
    const shared = await f.addResource({ title: 'Shared guide' })
    const areaDoc = await f.addResource({ title: 'Area handbook' })
    const own = await f.addResource({ title: 'Task notes' })
    const area = await add('entityCollection.add', 'areas', {
      title: 'Career',
      resources: [{ id: areaDoc.id }, { id: shared.id }],
      tags: [{ title: 'deep' }],
      urls: [{ url: 'https://career.example' }],
    })
    const goal = await add('entityCollection.add', 'goals', {
      title: 'Promotion',
      area_id: area.id,
    })
    const project = await add('entityCollection.add', 'projects', {
      title: 'Portfolio',
      goal_id: goal.id,
      resources: [{ id: shared.id }],
    })
    const task = await add('entity.add', 'tasks', {
      title: 'Write case study',
      project_id: project.id,
      resources: [{ id: own.id }],
      tags: [{ title: 'writing' }],
    })

    const context = getTaskContext(f.db, task.id)
    expect(context?.own.resources.map((r) => r.title)).toEqual(['Task notes'])
    expect(context?.own.tags.map((tag) => tag.title)).toEqual(['writing'])
    expect(
      context?.inherited.map((group) => ({
        source: `${group.source.kind}:${group.source.title}`,
        resources: group.resources.map((r) => r.title),
        urls: group.urls.map((u) => u.url),
        tags: group.tags.map((tag) => tag.title),
      })),
    ).toEqual([
      // The shared guide shows under the nearest owner only; the goal adds
      // nothing, so it's left out.
      {
        source: 'projects:Portfolio',
        resources: ['Shared guide'],
        urls: [],
        tags: [],
      },
      {
        source: 'areas:Career',
        resources: ['Area handbook'],
        urls: ['https://career.example'],
        tags: ['deep'],
      },
    ])

    // The same chain makes the area's tag a work tag for the scheduler.
    const settings = { ...readSettings(f.db), workTags: ['deep'] }
    expect(
      readSchedulerTasks(f.db, settings).find((row) => row.id === task.id)
        ?.isWork,
    ).toBe(true)
    f.runtime.dispose()
  })

  test('an unknown task has no context', async () => {
    const f = await setup()
    expect(getTaskContext(f.db, 'missing')).toBeNull()
    f.runtime.dispose()
  })
})
