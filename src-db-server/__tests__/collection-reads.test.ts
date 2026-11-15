import { expect, test } from 'bun:test'
import { createBackendRuntime } from '@d/bootstrap'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { ReadModelsRepository } from '@d/database/repositories/readModels'
import { ProgressStatus } from '@c/types/enums'
import { decodeSources, encodeSources } from '@c/types/readModels'

test('a page of collections filters by custom data key and status, and refuses misfits', async () => {
  const database = new UnHussleDB(':memory:')
  const runtime = createBackendRuntime(database)
  const add = async (
    kind: 'projects' | 'goals',
    title: string,
    changes: Record<string, unknown> = {},
  ) =>
    runtime.commands.execute('entityCollection.add', {
      kind,
      action: 'create',
      changes: { title, ...changes },
    })
  await add('projects', 'Dune', { custom_data: { tracker: { type: 'book' } } })
  await add('projects', 'Garden', {
    custom_data: { kanban: { stage: 'Later' } },
  })
  await add('projects', 'Emma', {
    custom_data: { tracker: { type: 'book' } },
    status: ProgressStatus.COMPLETED,
  })
  await add('goals', 'Read 1000 pages', {
    custom_data: { tracker: { type: 'book' } },
  })
  const reads = new ReadModelsRepository(database)
  const titles = async (
    kind: 'projects' | 'goals',
    options: Parameters<typeof reads.collections>[1],
  ) =>
    (await reads.collections(kind, options)).items
      .map(({ title }) => title)
      .sort()

  expect(await titles('projects', { customKey: 'tracker' })).toEqual([
    'Dune',
    'Emma',
  ])
  expect(await titles('goals', { customKey: 'tracker' })).toEqual([
    'Read 1000 pages',
  ])
  expect(
    await titles('projects', {
      customKey: 'tracker',
      status: ProgressStatus.COMPLETED,
    }),
  ).toEqual(['Emma'])

  const first = await reads.collections('projects', { limit: 2 })
  expect(first).toMatchObject({ total: 3 })
  const rest = await reads.collections('projects', {
    limit: 2,
    cursor: first.nextCursor ?? undefined,
  })
  expect([...first.items, ...rest.items]).toHaveLength(3)
  expect(rest.nextCursor).toBeNull()

  await expect(
    reads.collections('areas', { status: 'planned' }),
  ).rejects.toThrow('areas have no status')
  await expect(
    reads.collections('projects', { customKey: "x') --" }),
  ).rejects.toThrow('must be an extension ID')
  runtime.dispose()
})

test('sources resolve to the projects and goals they hold', async () => {
  const database = new UnHussleDB(':memory:')
  const runtime = createBackendRuntime(database)
  const add = async (
    kind: 'projects' | 'goals' | 'areas',
    title: string,
    changes: Record<string, unknown> = {},
  ) => {
    const row = await runtime.commands.execute('entityCollection.add', {
      kind,
      action: 'create',
      changes: { title, ...changes },
    })
    if (!row || Array.isArray(row)) throw new Error(`${title} was not created`)
    return row.id
  }
  const reading = await add('areas', 'Reading')
  const goal = await add('goals', 'Read 12 books', { area_id: reading })
  await add('projects', 'Dune', { goal_id: goal })
  await add('projects', 'Emma', { area_id: reading })
  const solo = await add('projects', 'Solo')
  await add('projects', 'Tagged', { tags: [{ title: 'classic' }] })
  await add('goals', 'Tagged goal', { tags: [{ title: 'classic' }] })
  await add('goals', 'Elsewhere')
  const reads = new ReadModelsRepository(database)
  const tag = (await reads.references('tags', { q: 'classic' })).items[0].id
  const titles = async (
    kind: 'projects' | 'goals',
    sources: NonNullable<Parameters<typeof reads.collections>[1]>['sources'],
  ) =>
    (await reads.collections(kind, { sources })).items
      .map(({ title }) => title)
      .sort()

  const area = [{ kind: 'areas' as const, id: reading }]
  expect(await titles('projects', area)).toEqual(['Dune', 'Emma'])
  expect(await titles('goals', area)).toEqual(['Read 12 books'])
  const byGoal = [{ kind: 'goals' as const, id: goal }]
  expect(await titles('projects', byGoal)).toEqual(['Dune'])
  expect(await titles('goals', byGoal)).toEqual(['Read 12 books'])
  const byTag = [{ kind: 'tags' as const, id: tag }]
  expect(await titles('projects', byTag)).toEqual(['Tagged'])
  expect(await titles('goals', byTag)).toEqual(['Tagged goal'])
  // Several sources add up; a project source holds no goals.
  const mixed = [{ kind: 'projects' as const, id: solo }, ...byTag]
  expect(await titles('projects', mixed)).toEqual(['Solo', 'Tagged'])
  expect(await titles('goals', mixed)).toEqual(['Tagged goal'])
  await expect(reads.collections('areas', { sources: area })).rejects.toThrow(
    'Areas have no sources',
  )
  runtime.dispose()
})

test('sources travel as kind:id pairs, and malformed ones are refused', () => {
  const sources = [
    { kind: 'areas' as const, id: 'a1' },
    { kind: 'tags' as const, id: 't1' },
  ]
  expect(decodeSources(encodeSources(sources))).toEqual(sources)
  expect(decodeSources('tasks:x')).toBeNull()
  expect(decodeSources('areas:')).toBeNull()
})
