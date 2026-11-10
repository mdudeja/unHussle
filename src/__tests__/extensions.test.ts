import { expect, mock, test } from 'bun:test'
import { Type } from '@sinclair/typebox'
import { createStore } from 'zustand/vanilla'
import { useStore } from '@/store'
import { createFrontendRuntime, type EntryTransport } from '@/bootstrap'
import type { EventHandlers } from '@/workflows/eventStream'
import type { FrontendExtension } from '@/extensions/sdk'
import { sampleFrontendExtension } from '../../examples/extensions/frontend'

type Api = Parameters<FrontendExtension['activate']>[0]
/** Creates an isolated test fixture for the frontend runtime with mocked services, storage, and transport, and registers the sample extension for integration testing. */
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
  const off = runtime.extensions.register({
    ...sampleFrontendExtension,
    /** Activates the frontend extension using the provided API context. */
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
  f.runtime.extensions.register({
    ...sampleFrontendExtension,
    /** Activates the frontend extension. */
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

test('registration rejects version/namespace/collisions and supports explicit owned overrides', async () => {
  const f = fixture()
  expect(() => f.runtime.extensions.register(sampleFrontendExtension)).toThrow(
    'already active',
  )
  expect(() =>
    f.runtime.extensions.register({
      id: 'future',
      sdkVersion: 99,
      /** Activates the extension so its frontend contributions become available to the application. */
      activate: () => {},
    }),
  ).toThrow('version')
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
    id: 'sample.replaceable',
    description: 'Replaceable action',
    input: Type.Null(),
    output: Type.String(),
    run: () => 'first',
  }
  const old = f.api.actions.register(action)
  expect(() => f.api.actions.register(action)).toThrow('collision')
  f.api.commands.register({
    id: 'sample.replaced',
    description: 'Run action',
    input: Type.Null(),
    output: Type.String(),
    steps: [{ id: 'run', action: action.id, input: { from: 'input' } }],
    result: { from: 'step', step: 'run' },
  })
  expect(await f.api.commands.execute('sample.replaced', null)).toBe('first')
  f.api.actions.register({ ...action, run: () => 'second' }, { override: true })
  old() // A stale disposer cannot revoke its replacement.
  expect(await f.api.commands.execute('sample.replaced', null)).toBe('second')
  expect(() =>
    f.api.menus.register({
      id: 'sample.tasksMenu',
      label: 'Duplicate',
      viewId: 'sample.tasks',
    }),
  ).toThrow('collision')
  f.runtime.dispose()
})

test('failed activation rolls back registrations, subscriptions and contributions', () => {
  const f = fixture()
  let cleaned = false
  expect(() =>
    f.runtime.extensions.register({
      id: 'broken',
      sdkVersion: 1,
      /** Activate the extension and register its contributions, ensuring any owned resources are cleaned up if activation fails. */
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
  const off = f.runtime.extensions.register({
    id: 'broken',
    sdkVersion: 1,
    /** Activates the extension and registers its frontend contributions with the application services. */
    activate: () => {},
  })
  off()
  f.runtime.dispose()
})

test('disposal invalidates dependent compiled commands rather than leaving stale callbacks', async () => {
  const f = fixture()
  let activeConsumer!: Api
  f.runtime.extensions.register({
    id: 'consumer',
    sdkVersion: 1,
    /** Registers the consumer titles command, which exposes the sample commands title output as a list of strings. */
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
    f.runtime.extensions.register({
      id: 'late',
      sdkVersion: 1,
      /** Activates the extension by registering the late.titles command, which delegates to sample.titles and returns an array of strings. */
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
