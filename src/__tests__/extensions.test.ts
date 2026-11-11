import { expect, mock, test } from 'bun:test'
import { Type } from '@sinclair/typebox'
import { createStore } from 'zustand/vanilla'
import { useStore } from '@/store'
import { createFrontendRuntime, type EntryTransport } from '@/bootstrap'
import type { EventHandlers } from '@/workflows/eventStream'
import type { FrontendExtension } from '@/extensions/sdk'
import sampleFrontendExtension from '../../examples/extensions/sample/frontend'
import { createExtensionLoader } from '@/extensions/loader'
import type { InstalledExtension } from '@c/extensions/manifest'

type Api = Parameters<FrontendExtension['activate']>[0]
function fixture() {
  let handlers!: EventHandlers
  const records = [{ id: 'one', title: 'Task' }]
  const read = mock(async () => records)
  const service: EntryTransport = {
    fetchPaginated: read,
    fetchById: async () => records[0],
    search: read,
    create: async (values, options) => {
      const row = { id: 'created', title: String(values.title) }
      records.push(row)
      const event = {
        kind: 'tasks',
        action: 'create',
        operationId: options?.operationId,
        result: row,
      }
      await handlers.onEvent('entity.add', event)
      await handlers.onEvent('tasks.add', event)
      return row
    },
    update: async () => records[0],
    delete: async () => records[0],
    reset: async () => ({}),
  }
  const services = {
    tasks: service,
    projects: service,
    goals: service,
    areas: service,
    resources: service,
    tags: service,
    urls: service,
    time_entries: service,
  }
  const storage = new Map<string, string>()
  const runtime = createFrontendRuntime(
    createStore(() => useStore.getInitialState()),
    {
      services,
      eventTimeoutMs: 10,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value)
        },
        removeItem: (key) => {
          storage.delete(key)
        },
      },
      transport: {
        connect: (value) => {
          handlers = value
        },
        ready: () => Promise.resolve(),
        close: () => {},
      },
    },
  )
  let api!: Api
  const off = runtime.extensions.register('sample', {
    activate: (value) => {
      api = value
      sampleFrontendExtension.activate(value)
    },
  })
  return { runtime, api, off, read }
}

test('frontend sample invokes supported queries and owns menu/view lifecycle', async () => {
  const f = fixture()
  expect(await f.api.commands.execute('sample.titles', null)).toEqual(['Task'])
  expect(f.read).toHaveBeenCalledTimes(1)
  const key = f.runtime.defineList('tasks')
  expect(f.runtime.queries.snapshot(key).data).toEqual([
    { id: 'one', title: 'Task' },
  ])
  expect(
    f.runtime.extensions.contributions.snapshot().menus.map((menu) => menu.id),
  ).toEqual(['sample.tasksMenu'])
  expect(
    f.runtime.extensions.contributions.snapshot().views.map((view) => view.id),
  ).toEqual(['sample.tasks'])
  await f.api.settings.set('compact', true)
  let events = 0
  f.api.events.on('tasks.add', () => {
    events++
  })
  await f.api.services.execute('entity.add', {
    kind: 'tasks',
    action: 'create',
    changes: { title: 'From SDK' },
  })
  expect(events).toBe(1)
  f.off()
  expect(f.runtime.extensions.contributions.snapshot()).toEqual({
    menus: [],
    views: [],
  })
  await f.runtime.commands.execute('entity.add', {
    kind: 'tasks',
    action: 'create',
    changes: { title: 'After removal' },
  })
  expect(events).toBe(1)
  expect(() => f.api.commands.execute('sample.titles', null)).toThrow(
    'disposed',
  )
  let next!: Api
  f.runtime.extensions.register('sample', {
    activate: (api) => {
      next = api
      sampleFrontendExtension.activate(api)
    },
  })
  expect(await next.settings.get('compact')).toBe(true)
  f.runtime.dispose()
  expect(f.runtime.extensions.contributions.snapshot()).toEqual({
    menus: [],
    views: [],
  })
})

test('registration rejects invalid IDs and duplicates; stale disposers are inert', async () => {
  const f = fixture()
  expect(() =>
    f.runtime.extensions.register('sample', sampleFrontendExtension),
  ).toThrow('already active')
  for (const id of ['kernel', 'Bad', '1x'])
    expect(() =>
      f.runtime.extensions.register(id, { activate: () => {} }),
    ).toThrow('Invalid extension ID')
  expect(() =>
    f.api.actions.register({
      id: 'entity.hijack',
      description: 'Bad namespace',
      input: Type.Null(),
      output: Type.Null(),
      run: () => null,
    }),
  ).toThrow('belong')
  const action = {
    id: 'sample.repeatable',
    description: 'Repeatable action',
    input: Type.Null(),
    output: Type.String(),
    run: () => 'first',
  }
  const old = f.api.actions.register(action)
  expect(() => f.api.actions.register(action)).toThrow('Duplicate')
  old()
  f.api.actions.register({ ...action, run: () => 'second' })
  old() // Already disposed: must not remove the new registration.
  f.api.commands.register({
    id: 'sample.repeated',
    description: 'Run action',
    input: Type.Null(),
    output: Type.String(),
    steps: [{ id: 'run', action: action.id, input: { from: 'input' } }],
    result: { from: 'step', step: 'run' },
  })
  expect(await f.api.commands.execute('sample.repeated', null)).toBe('second')
  expect(() =>
    f.api.menus.register({
      id: 'sample.tasksMenu',
      label: 'Duplicate',
      viewId: 'sample.tasks',
    }),
  ).toThrow('Duplicate')
  f.runtime.dispose()
})

test('failed activation rolls back registrations, subscriptions and contributions', () => {
  const f = fixture()
  let cleaned = false
  expect(() =>
    f.runtime.extensions.register('broken', {
      activate: (api) => {
        api.own(() => {
          cleaned = true
        })
        api.menus.register({
          id: 'broken.menu',
          label: 'Broken',
          run: () => {},
        })
        api.events.on('tasks.add', () => {
          throw new Error('must be removed')
        })
        throw new Error('activation failed')
      },
    }),
  ).toThrow('activation failed')
  expect(cleaned).toBe(true)
  expect(
    f.runtime.extensions.contributions.snapshot().menus.map((menu) => menu.id),
  ).toEqual(['sample.tasksMenu'])
  const off = f.runtime.extensions.register('broken', {
    activate: () => {},
  })
  off()
  f.runtime.dispose()
})

test('disposal invalidates dependent compiled commands rather than leaving stale callbacks', async () => {
  const f = fixture()
  let activeConsumer!: Api
  f.runtime.extensions.register('consumer', {
    activate: (api) => {
      activeConsumer = api
      api.commands.register({
        id: 'consumer.titles',
        description: 'Use sample command',
        input: Type.Null(),
        output: Type.Array(Type.String()),
        steps: [
          { id: 'sample', command: 'sample.titles', input: { from: 'input' } },
        ],
        result: { from: 'step', step: 'sample' },
      })
    },
  })
  expect(
    await activeConsumer.commands.execute('consumer.titles', null),
  ).toEqual(['Task'])
  f.off()
  await expect(
    activeConsumer.commands.execute('consumer.titles', null),
  ).rejects.toThrow('Missing')
  activeConsumer.actions.register({
    id: 'consumer.independent',
    description: 'Independent registration still works',
    input: Type.Null(),
    output: Type.Null(),
    run: () => null,
  })
  let consumer!: Api
  // A second consumer can activate, but compilation of a now-missing dependency must fail.
  expect(() =>
    f.runtime.extensions.register('late', {
      activate: (api) => {
        consumer = api
        api.commands.register({
          id: 'late.titles',
          description: 'Missing sample',
          input: Type.Null(),
          output: Type.Array(Type.String()),
          steps: [
            {
              id: 'sample',
              command: 'sample.titles',
              input: { from: 'input' },
            },
          ],
          result: { from: 'step', step: 'sample' },
        })
      },
    }),
  ).toThrow('Missing')
  expect(() => consumer.services.queries.list('tasks')).toThrow('disposed')
  f.runtime.dispose()
})

test('imperative SDK reads return detached snapshots without mutating coordinator state', async () => {
  const f = fixture()
  const rows = await f.api.services.queries.list('tasks')
  rows[0].title = 'Caller-local change'
  rows.push({ id: 'local-only', title: 'Not persisted' })
  expect(
    f.runtime.queries.snapshot(f.runtime.defineList('tasks')).data,
  ).toEqual([{ id: 'one', title: 'Task' }])
  const row = await f.api.services.queries.get('tasks', 'one')
  row!.title = 'Another local change'
  expect(
    f.runtime.queries.snapshot(f.runtime.defineDetail('tasks', 'one')).data,
  ).toEqual({ id: 'one', title: 'Task' })
  f.runtime.dispose()
})

const installed = (id: string, enabled = true): InstalledExtension => ({
  folder: id,
  manifest: { id, name: id, version: '1', frontend: 'frontend.tsx' },
  enabled,
  status: enabled ? 'active' : 'disabled',
})

test('the loader activates enabled frontend entries and unloads disabled ones', async () => {
  const f = fixture()
  f.off()
  const loader = createExtensionLoader(f.runtime.extensions.register, () =>
    Promise.resolve({ default: sampleFrontendExtension }),
  )
  await loader.sync([installed('sample')])
  expect(
    f.runtime.extensions.contributions.snapshot().menus.map((menu) => menu.id),
  ).toEqual(['sample.tasksMenu'])
  await loader.sync([installed('sample', false)])
  expect(f.runtime.extensions.contributions.snapshot().menus).toEqual([])
  f.runtime.dispose()
})

test('the loader reports bad entries and ignores imports made stale by a reset', async () => {
  const f = fixture()
  f.off()
  let finish!: () => void
  const loader = createExtensionLoader(f.runtime.extensions.register, (url) =>
    url.includes('/broken/')
      ? Promise.resolve({})
      : new Promise((resolve) => {
          finish = () => resolve({ default: sampleFrontendExtension })
        }),
  )
  await loader.sync([installed('broken')])
  expect(loader.errors.snapshot().broken).toContain('default-export')
  const slow = loader.sync([installed('sample')])
  loader.reset()
  finish()
  await slow
  expect(f.runtime.extensions.contributions.snapshot().menus).toEqual([])
  expect(loader.errors.snapshot()).toEqual({})
  f.runtime.dispose()
})

test('disposal runs every cleanup in reverse order, even after one throws', () => {
  const f = fixture()
  const order: string[] = []
  const off = f.runtime.extensions.register('cleanup', {
    activate: (api) => {
      api.own(() => order.push('first'))
      api.own(() => {
        order.push('second')
        throw new Error('cleanup failed')
      })
    },
  })
  off()
  expect(order).toEqual(['second', 'first'])
  f.runtime.dispose()
})

test('workflow steps must be registered commands', () => {
  const f = fixture()
  const workflow = {
    id: 'sample.flow',
    description: 'Flow',
    input: Type.Null(),
    output: Type.Unknown(),
    result: { from: 'step' as const, step: 'one' },
  }
  expect(() =>
    f.api.workflows.register({
      ...workflow,
      steps: [
        { id: 'one', command: 'sample.missing', input: { from: 'input' } },
      ],
    }),
  ).toThrow('needs a registered command')
  f.runtime.dispose()
})
