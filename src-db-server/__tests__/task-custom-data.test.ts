import { expect, test } from 'bun:test'
import { Value } from '@sinclair/typebox/value'
import { createBackendRuntime } from '@d/bootstrap'
import { UnHussleDB } from '@d/database/UnHussleDB'
import {
  insertTaskSchema,
  updateGoalSchema,
  updateTaskSchema,
} from '@d/database/validation'
import type { EntryRecord } from '@c/workflows/contracts'
import { ReadModelsRepository } from '@d/database/repositories/readModels'
import { ProgressStatus } from '@c/types/enums'

test('the schemas only accept extension-keyed objects or null as custom data', () => {
  for (const custom_data of [{ kanban: { stage: 'Review' } }, { kanban: null }, null])
    expect(Value.Check(updateTaskSchema, { custom_data })).toBe(true)
  for (const custom_data of [['Review'], 'Review', 1, { stage: 'Review' }]) {
    expect(Value.Check(updateTaskSchema, { custom_data })).toBe(false)
    expect(Value.Check(updateGoalSchema, { custom_data })).toBe(false)
  }
  expect(Value.Check(insertTaskSchema, { title: 'No custom data' })).toBe(true)
})

const setup = async () => {
  const runtime = createBackendRuntime(new UnHussleDB(':memory:'))
  const add = async (kind: 'tasks' | 'goals', title: string) =>
    (await runtime.commands.execute(
      kind === 'tasks' ? 'entity.add' : 'entityCollection.add',
      { kind, action: 'create', changes: { title } },
    )) as EntryRecord
  const change = (kind: 'tasks' | 'goals', id: string, custom_data: unknown) =>
    runtime.commands.execute(
      kind === 'tasks' ? 'entity.change' : 'entityCollection.change',
      { kind, action: 'update', id, changes: { custom_data } },
    ) as Promise<EntryRecord>
  return { runtime, add, change }
}

test('custom data merges per extension and null removes a key', async () => {
  const { runtime, add, change } = await setup()
  const task = await add('tasks', 'Card')
  await change('tasks', task.id, { kanban: { stage: 'Review' } })
  expect(await change('tasks', task.id, { tracker: { type: 'book' } })).toMatchObject({
    custom_data: { kanban: { stage: 'Review' }, tracker: { type: 'book' } },
  })
  const removed = await change('tasks', task.id, { kanban: null })
  expect(removed.custom_data).toEqual({ tracker: { type: 'book' } })
  expect((await change('tasks', task.id, null)).custom_data).toBeNull()
  runtime.dispose()
})

test('the domain refuses custom data that is not keyed objects, for any kind', async () => {
  const { runtime, add, change } = await setup()
  const task = await add('tasks', 'Card')
  const goal = await add('goals', 'Read more')
  for (const [kind, id] of [['tasks', task.id], ['goals', goal.id]] as const) {
    await expect(change(kind, id, ['Review'])).rejects.toThrow('must be a JSON object')
    await expect(change(kind, id, 'Review')).rejects.toThrow('must be a JSON object')
    await expect(change(kind, id, { stage: 'Review' })).rejects.toThrow(
      'Custom data "stage" must be a JSON object',
    )
  }
  runtime.dispose()
})

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
  await add('projects', 'Garden', { custom_data: { kanban: { stage: 'Later' } } })
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
  ) => (await reads.collections(kind, options)).items.map(({ title }) => title).sort()

  expect(await titles('projects', { customKey: 'tracker' })).toEqual(['Dune', 'Emma'])
  expect(await titles('goals', { customKey: 'tracker' })).toEqual(['Read 1000 pages'])
  expect(
    await titles('projects', { customKey: 'tracker', status: ProgressStatus.COMPLETED }),
  ).toEqual(['Emma'])

  const first = await reads.collections('projects', { limit: 2 })
  expect(first).toMatchObject({ total: 3 })
  const rest = await reads.collections('projects', {
    limit: 2,
    cursor: first.nextCursor ?? undefined,
  })
  expect([...first.items, ...rest.items]).toHaveLength(3)
  expect(rest.nextCursor).toBeNull()

  await expect(reads.collections('areas', { status: 'planned' })).rejects.toThrow(
    'areas have no status',
  )
  await expect(reads.collections('projects', { customKey: "x') --" })).rejects.toThrow(
    'must be an extension ID',
  )
  runtime.dispose()
})
