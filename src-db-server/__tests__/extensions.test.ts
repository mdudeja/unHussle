import { createTelemetry } from '@c/workflows/telemetry'
import { afterAll, expect, test } from 'bun:test'
import { Type } from '@sinclair/typebox'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createBackendRuntime } from '@d/bootstrap'
import { UnHussleDB } from '@d/database/UnHussleDB'
import sampleBackendExtension from '../../examples/extensions/sample/backend'
import type { BackendExtension, AtomicDomain } from '@d/extensions/sdk'
import { tasks, resources, appSettings } from '@d/database/schemas'
import { WorkflowFailure } from '@c/workflows/composition'

type Api = Parameters<BackendExtension['activate']>[0]
const roots: string[] = []
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})
async function fixture() {
  const database = new UnHussleDB(':memory:')
  const root = mkdtempSync(join(tmpdir(), 'unhussle-extension-'))
  roots.push(root)
  const telemetry = createTelemetry({ side: 'backend' })
  const runtime = createBackendRuntime(database, { vaultDir: root, telemetry })
  const db = await database.getDb()
  let api!: Api
  const off = runtime.extensions.register('sample', {
    activate: (value) => {
      api = value
      sampleBackendExtension.activate(value)
    },
  })
  return { database, runtime, db, root, api, off, telemetry }
}

test('sample extension registers, invokes, composes and disposes through the public SDK', async () => {
  const f = await fixture()
  expect(
    await f.api.commands.execute('sample.captureAndDescribe', 'SDK task'),
  ).toBe('SDK task')
  const row = f.db.select().from(tasks).get()!
  expect(row.title).toBe('SDK task')
  expect(await f.api.settings.get('lastCapture')).toBeNumber()
  expect(Object.keys(f.api.services).sort()).toEqual(['execute', 'queries'])
  const query = await f.api.services.queries.get('tasks', row.id)
  expect(query?.id).toBe(row.id)
  const sdkSettings = await f.api.settings.get('lastCapture')
  f.off()
  await f.runtime.commands.execute('entity.add', {
    kind: 'tasks',
    action: 'create',
    changes: { title: 'After disposal' },
  })
  expect(
    f.db.select().from(appSettings).get()?.settings.extensions?.sample
      ?.lastCapture,
  ).toBe(sdkSettings)
  expect(() => f.api.services.queries.list('tasks')).toThrow('disposed')
  expect(() => f.api.commands.execute('sample.describe', row.id)).toThrow(
    'disposed',
  )
  const offAgain = f.runtime.extensions.register(
    'sample',
    sampleBackendExtension,
  )
  offAgain()
  f.runtime.dispose()
})

test('custom atomic mutations preserve rollback, vault compensation and publication integrity', async () => {
  const f = await fixture()
  const events: string[] = []
  f.runtime.events.onAny((name) => {
    events.push(name)
  })
  let leaked!: AtomicDomain
  f.api.atomic.actions.register({
    id: 'sample.rollbackAction',
    description: 'Exercise integrity',
    input: Type.Null(),
    output: Type.Null(),
    run: (_input, domain) => {
      leaked = domain
      expect(Object.keys(domain)).toEqual(['mutations'])
      domain.mutations.apply({
        kind: 'resources',
        action: 'create',
        changes: { title: 'Compensated' },
      })
      domain.mutations.apply({
        kind: 'tasks',
        action: 'create',
        changes: {
          title: 'Invalid',
          scheduled_start: 2000,
          scheduled_end: 1000,
        },
      })
      return null
    },
  })
  f.api.atomic.commands.register({
    id: 'sample.rollback',
    description: 'Rollback',
    input: Type.Null(),
    output: Type.Null(),
    steps: [
      { id: 'work', action: 'sample.rollbackAction', input: { from: 'input' } },
    ],
    result: { from: 'step', step: 'work' },
  })
  await expect(
    f.api.commands.execute('sample.rollback', null),
  ).rejects.toThrow()
  expect(f.db.select().from(resources).all()).toEqual([])
  expect(f.db.select().from(tasks).all()).toEqual([])
  expect(readdirSync(f.root).filter((name) => name.endsWith('.md'))).toEqual([])
  expect(events).toEqual([])
  expect(() =>
    leaked.mutations.apply({
      kind: 'tasks',
      action: 'create',
      changes: { title: 'Escaped' },
    }),
  ).toThrow('expired')
  f.runtime.dispose()
})

test('atomic action output validation and promises fail before commit', async () => {
  const f = await fixture()
  f.api.atomic.actions.register({
    id: 'sample.asyncAction',
    description: 'Invalid async action',
    input: Type.Null(),
    output: Type.Unknown(),
    run: () => Promise.resolve('not synchronous'),
  })
  f.api.atomic.commands.register({
    id: 'sample.async',
    description: 'Reject promises',
    input: Type.Null(),
    output: Type.Unknown(),
    steps: [
      { id: 'async', action: 'sample.asyncAction', input: { from: 'input' } },
    ],
    result: { from: 'step', step: 'async' },
  })
  await expect(f.api.commands.execute('sample.async', null)).rejects.toThrow(
    'synchronous',
  )
  f.runtime.dispose()
})

test('workflow partial failure reports committed steps without replaying or rolling them back', async () => {
  const f = await fixture()
  let attempts = 0
  f.api.actions.register({
    id: 'sample.failAction',
    description: 'Fail',
    input: Type.String(),
    output: Type.String(),
    run: () => {
      attempts++
      throw new Error('step failed')
    },
  })
  f.api.commands.register({
    id: 'sample.fail',
    description: 'Fail',
    input: Type.String(),
    output: Type.String(),
    steps: [
      { id: 'fail', action: 'sample.failAction', input: { from: 'input' } },
    ],
    result: { from: 'step', step: 'fail' },
  })
  f.api.workflows.register({
    id: 'sample.partial',
    description: 'Partial commit',
    input: Type.String(),
    output: Type.String(),
    steps: [
      { id: 'capture', command: 'sample.capture', input: { from: 'input' } },
      {
        id: 'failure',
        command: 'sample.fail',
        input: { from: 'step', step: 'capture', path: ['id'] },
      },
    ],
    result: { from: 'step', step: 'failure' },
  })
  try {
    await f.api.commands.execute('sample.partial', 'Keep committed')
    throw new Error('Expected failure')
  } catch (error) {
    expect(error).toBeInstanceOf(WorkflowFailure)
    expect((error as WorkflowFailure).completed.map((step) => step.id)).toEqual(
      ['capture'],
    )
    expect((error as WorkflowFailure).failedStep).toBe('failure')
  }
  expect(
    f.db
      .select()
      .from(tasks)
      .all()
      .map((task) => task.title),
  ).toEqual(['Keep committed'])
  expect(attempts).toBe(1)
  f.runtime.dispose()
})

test('namespaced settings persist independently and preserve application settings', async () => {
  const f = await fixture()
  f.db
    .insert(appSettings)
    .values({ id: 'default', settings: { vaultDir: f.root } })
    .onConflictDoNothing()
    .run()
  await f.api.settings.set('theme', { compact: true })
  expect(await f.api.settings.get('toString')).toBeUndefined()
  f.off()
  const off = f.runtime.extensions.register('other', {
    activate: (api) => {
      expect(api.id).toBe('other')
    },
  })
  let reloaded!: Api
  f.runtime.extensions.register('sample', {
    activate: (api) => {
      reloaded = api
      sampleBackendExtension.activate(api)
    },
  })
  expect(await reloaded.settings.get('theme')).toEqual({ compact: true })
  expect(f.db.select().from(appSettings).get()?.settings.vaultDir).toBe(f.root)
  off()
  f.runtime.dispose()
})

test('invalid custom action output rolls its domain writes back before publication', async () => {
  const f = await fixture()
  const events: string[] = []
  f.runtime.events.onAny((name) => {
    events.push(name)
  })
  f.api.atomic.actions.register({
    id: 'sample.badOutputAction',
    description: 'Invalid output',
    input: Type.Null(),
    output: Type.Number(),
    run: (_input, domain) => {
      domain.mutations.apply({
        kind: 'tasks',
        action: 'create',
        changes: { title: 'Never committed' },
      })
      return 'wrong' as unknown as number
    },
  })
  f.api.atomic.commands.register({
    id: 'sample.badOutput',
    description: 'Validate before commit',
    input: Type.Null(),
    output: Type.Number(),
    steps: [
      {
        id: 'work',
        action: 'sample.badOutputAction',
        input: { from: 'input' },
      },
    ],
    result: { from: 'step', step: 'work' },
  })
  await expect(
    f.api.commands.execute('sample.badOutput', null),
  ).rejects.toThrow('output')
  expect(f.db.select().from(tasks).all()).toEqual([])
  expect(events).toEqual([])
  f.runtime.dispose()
})

test('compatible atomic commands inline without nested commits and keep one trace', async () => {
  const f = await fixture()
  const events: string[] = []
  f.runtime.events.onAny((name) => {
    events.push(name)
  })
  f.api.atomic.actions.register({
    id: 'sample.failInlineAction',
    description: 'Check uncommitted row then fail',
    input: Type.Object({ id: Type.String() }),
    output: Type.Null(),
    run: (input, domain) => {
      expect(domain.mutations.get('tasks', input.id)?.title).toBe('Inline task')
      throw new Error('inline failed')
    },
  })
  f.api.atomic.commands.register({
    id: 'sample.inline',
    description: 'Inline compatible capture',
    input: Type.String(),
    output: Type.Null(),
    steps: [
      { id: 'capture', command: 'sample.capture', input: { from: 'input' } },
      {
        id: 'fail',
        action: 'sample.failInlineAction',
        input: { from: 'step', step: 'capture' },
      },
    ],
    result: { from: 'step', step: 'fail' },
  })
  await expect(
    f.api.commands.execute('sample.inline', 'Inline task'),
  ).rejects.toThrow('inline failed')
  expect(f.db.select().from(tasks).all()).toEqual([])
  expect(events).toEqual([])
  expect(
    await f.api.commands.execute('sample.captureAndDescribe', 'Traced capture'),
  ).toBe('Traced capture')
  const workflow = f.telemetry
    .recent({ kind: 'command' })
    .find((span) => span.name === 'sample.captureAndDescribe')!
  expect(workflow).toBeDefined()
  const spans = f.telemetry.recent({ traceId: workflow.traceId })
  expect(spans.some((span) => span.name === 'sample.captureAction')).toBe(true)
  expect(spans.some((span) => span.name === 'tasks.add')).toBe(true)
  f.runtime.dispose()
})

test('unsupported entity content never enters SDK mutation events or replay payloads', async () => {
  const f = await fixture()
  const payloads: unknown[] = []
  f.runtime.events.onAny((_name, payload) => {
    payloads.push(payload)
  })
  f.api.atomic.actions.register({
    id: 'sample.safeContentAction',
    description: 'Only index metadata belongs in entity writes',
    input: Type.Null(),
    output: Type.Null(),
    run: (_input, domain) => {
      domain.mutations.apply({
        kind: 'resources',
        action: 'create',
        changes: { title: 'Safe SDK note', content: 'very private body' },
      })
      return null
    },
  })
  f.api.atomic.commands.register({
    id: 'sample.safeContent',
    description: 'Save metadata only',
    input: Type.Null(),
    output: Type.Null(),
    steps: [
      {
        id: 'work',
        action: 'sample.safeContentAction',
        input: { from: 'input' },
      },
    ],
    result: { from: 'step', step: 'work' },
  })
  await f.api.commands.execute('sample.safeContent', null)
  await f.runtime.commands.execute('entity.add', {
    kind: 'resources',
    action: 'create',
    changes: { title: 'Safe built-in note', content: 'very private body' },
  })
  expect(payloads.length).toBeGreaterThan(0)
  expect(JSON.stringify(payloads)).not.toContain('very private body')
  f.runtime.dispose()
})

test('built-ins and extension definitions share the application catalog without proxy registrations', async () => {
  const f = await fixture()
  for (const id of [
    'entity.add',
    'scheduler.settings.change',
    'vault.rescan',
    'sample.capture',
    'sample.describe',
    'sample.captureAndDescribe',
  ]) {
    expect(f.runtime.registry.definition(id).id).toBe(id)
  }
  expect(() =>
    f.runtime.commands.handle('entity.add', () => undefined),
  ).toThrow('composition registry')

  // Removing a provider revokes its compiled workflows at the same source used by HTTP dispatch.
  f.runtime.registry.remove([], ['sample.capture'])
  expect(() =>
    f.runtime.registry.definition('sample.captureAndDescribe'),
  ).toThrow('Missing command')
  await expect(
    f.runtime.commands.invoke('sample.capture', 'Gone'),
  ).rejects.toThrow('Missing command')
  await expect(
    f.api.commands.execute('sample.capture', 'Gone'),
  ).rejects.toThrow('Missing command')
  expect(f.db.select().from(tasks).all()).toEqual([])
  f.runtime.dispose()
})

test('extension compositions cannot invoke private kernel actions or mix execution boundaries', async () => {
  const f = await fixture()
  const definition = {
    id: 'sample.bypass',
    description: 'Unsupported composition',
    input: Type.Unknown(),
    output: Type.Unknown(),
    steps: [
      {
        id: 'write',
        action: 'kernel.mutation.createRow',
        input: { from: 'input' as const },
      },
    ],
    result: { from: 'step' as const, step: 'write' },
  }
  expect(() => f.api.atomic.commands.register(definition)).toThrow(
    'not exposed',
  )
  expect(() =>
    f.api.commands.register({
      ...definition,
      steps: [{ id: 'write', command: 'entity.add', input: { from: 'input' } }],
    }),
  ).toThrow('Incompatible execution boundary')
  expect(() =>
    f.api.atomic.commands.register({
      ...definition,
      steps: [
        {
          id: 'write',
          action: 'sample.describeAction',
          input: { from: 'literal', value: 'id' },
        },
      ],
    }),
  ).toThrow('Application action cannot run atomically')
  expect(() =>
    f.api.commands.register({
      ...definition,
      steps: [
        {
          id: 'write',
          action: 'sample.captureAction',
          input: { from: 'literal', value: 'title' },
        },
      ],
    }),
  ).toThrow('Atomic action requires an atomic command')
  expect(f.db.select().from(tasks).all()).toEqual([])
  f.runtime.dispose()
})

test('compatible atomic commands from different extensions inline in one transaction', async () => {
  const f = await fixture()
  let consumer!: Api
  f.runtime.extensions.register('consumer', {
    activate: (api) => {
      consumer = api
      api.atomic.actions.register({
        id: 'consumer.fail',
        description: 'Read the uncommitted row and fail',
        input: Type.Object({ id: Type.String() }),
        output: Type.Null(),
        run: ({ id }, domain) => {
          expect(domain.mutations.get('tasks', id)?.title).toBe('Cross-scope')
          throw new Error('Consumer failed')
        },
      })
      api.atomic.commands.register({
        id: 'consumer.capture',
        description: 'Compose an exposed provider command',
        input: Type.String(),
        output: Type.Null(),
        steps: [
          {
            id: 'capture',
            command: 'sample.capture',
            input: { from: 'input' },
          },
          {
            id: 'fail',
            action: 'consumer.fail',
            input: { from: 'step', step: 'capture' },
          },
        ],
        result: { from: 'step', step: 'fail' },
      })
    },
  })
  await expect(
    consumer.commands.execute('consumer.capture', 'Cross-scope'),
  ).rejects.toThrow('Consumer failed')
  expect(f.db.select().from(tasks).all()).toEqual([])
  f.off()
  await expect(
    consumer.commands.execute('consumer.capture', 'Gone'),
  ).rejects.toThrow('Missing command')
  f.runtime.dispose()
})

test('a registered workflow invokes mutation, vault and scheduler definitions once with their original events', async () => {
  const f = await fixture()
  const publications: { name: string; operationId?: string }[] = []
  f.runtime.events.onAny((name, payload) => {
    publications.push({
      name,
      operationId: (payload as { operationId?: string }).operationId,
    })
  })
  f.api.workflows.register({
    id: 'sample.shared',
    description: 'Use the application command catalog',
    input: Type.Null(),
    output: Type.Unknown(),
    steps: [
      {
        id: 'task',
        command: 'entity.add',
        input: {
          from: 'literal',
          value: {
            kind: 'tasks',
            action: 'create',
            changes: { title: 'One write' },
            operationId: 'shared-task',
          },
        },
      },
      {
        id: 'vault',
        command: 'vault.rescan',
        input: { from: 'literal', value: { operationId: 'shared-vault' } },
      },
      {
        id: 'plan',
        command: 'scheduler.generate',
        input: {
          from: 'literal',
          value: {
            date: '2026-11-11',
            timezone: 'UTC',
            operationId: 'shared-plan',
          },
        },
      },
    ],
    result: { from: 'step', step: 'plan' },
  })
  await f.api.commands.execute('sample.shared', null)
  expect(
    f.db
      .select()
      .from(tasks)
      .all()
      .map((task) => task.title),
  ).toEqual(['One write'])
  expect(
    publications.filter(({ name }) =>
      [
        'entity.add',
        'tasks.add',
        'vault.changed',
        'scheduler.changed',
      ].includes(name),
    ),
  ).toEqual([
    { name: 'entity.add', operationId: 'shared-task' },
    { name: 'tasks.add', operationId: 'shared-task' },
    { name: 'vault.changed', operationId: 'shared-vault' },
    { name: 'scheduler.changed', operationId: 'shared-plan' },
  ])
  const commands = f.telemetry.recent({ kind: 'command' })
  const root = commands.find((span) => span.name === 'sample.shared')!
  for (const name of ['entity.add', 'vault.rescan', 'scheduler.generate']) {
    const calls = commands.filter(
      (span) => span.name === name && span.traceId === root.traceId,
    )
    expect(calls).toHaveLength(1)
    expect(calls[0].parentId).toBe(root.spanId)
  }
  f.runtime.dispose()
})
