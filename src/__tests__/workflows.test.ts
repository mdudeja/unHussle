import { describe, expect, mock, test } from 'bun:test'
import { createStore } from 'zustand/vanilla'
import {
  createFrontendRuntime,
  getFrontendRuntime,
  type EntryTransport,
} from '@/workflows/runtime'
import type { EventHandlers, EventTransport } from '@/workflows/eventStream'
import type { MutationOptions } from '@/services/database/DbService'
import { useStore, type StoreState } from '@/store'
import { ProgressStatus } from '@c/types'
import {
  commandHeadForKind,
  type EntityKind,
  type EntryKind,
  type EntryRecord,
  type MutationEvent,
} from '@c/workflows/contracts'
import { createTelemetry, type Span } from '@c/workflows/telemetry'

const kinds = [
  'tasks',
  'projects',
  'areas',
  'goals',
  'resources',
  'tags',
  'urls',
  'time_entries',
] as const

/** Stands in for the SSE stream: delivers events in order, like the real one. */
function fakeEventStream() {
  let handlers: EventHandlers | undefined
  let queue: Promise<unknown> = Promise.resolve()
  const transport: EventTransport = {
    connect: (next) => {
      handlers = next
    },
    ready: () => Promise.resolve(),
    close: () => {
      handlers = undefined
    },
  }
  const enqueue = (work: () => void | Promise<void> | undefined) => {
    queue = queue.then(work)
    return queue
  }
  return {
    transport,
    emit: (name: string, payload: unknown) =>
      enqueue(() => handlers?.onEvent(name, payload)),
    resync: () => enqueue(() => handlers?.onResync()),
  }
}

function fixture({
  initialStorage,
  emitEvents = true,
  eventTimeoutMs,
}: {
  initialStorage?: string
  emitEvents?: boolean
  eventTimeoutMs?: number
} = {}) {
  const stream = fakeEventStream()
  const rows = new Map<EntryKind, Map<string, EntryRecord>>()

  // Publishes what the backend would: the family event, then the kind event.
  const publish = (
    kind: EntryKind,
    verb: string,
    event: Omit<MutationEvent, 'kind' | 'operationId'>,
    options?: MutationOptions,
  ) => {
    if (!emitEvents) return
    const payload = {
      ...event,
      kind,
      operationId: options?.operationId ?? crypto.randomUUID(),
    }
    setTimeout(() => {
      void stream.emit(`${commandHeadForKind[kind]}.${verb}`, payload)
      void stream.emit(`${kind}.${verb}`, payload)
    }, 0)
  }

  const services = Object.fromEntries(
    kinds.map((kind) => {
      const data = new Map<string, EntryRecord>()
      rows.set(kind, data)
      const service: EntryTransport = {
        create: mock(
          async (
            changes: Record<string, unknown>,
            options?: MutationOptions,
          ) => {
            const row = { id: crypto.randomUUID(), ...changes }
            data.set(row.id, row)
            publish(
              kind,
              'add',
              { action: 'create', changes, result: row },
              options,
            )
            return row
          },
        ),
        update: mock(
          async (
            id: string,
            changes: Record<string, unknown>,
            options?: MutationOptions,
          ) => {
            const previous = data.get(id)
            if (!previous) throw new Error('Missing entity')
            const row = { ...previous, ...changes }
            data.set(id, row)
            publish(
              kind,
              'change',
              { action: 'update', id, changes, result: row },
              options,
            )
            return row
          },
        ),
        delete: mock(async (id: string, options?: MutationOptions) => {
          const row = data.get(id)
          if (!row) throw new Error('Missing entity')
          data.delete(id)
          publish(
            kind,
            'delete',
            { action: 'delete', id, result: row },
            options,
          )
          return row
        }),
        reset: async (options?: MutationOptions) => {
          const deleted = [...data.values()]
          data.clear()
          publish(
            kind,
            'deleteAll',
            { action: 'deleteAll', result: deleted },
            options,
          )
          return { deleted: deleted.length }
        },
        fetchPaginated: mock(async () => [...data.values()]),
        fetchById: async (id) => {
          const row = data.get(id)
          if (!row) throw new Error('Missing entity')
          return { ...row, hydrated: true }
        },
        search: async (term) =>
          [...data.values()].filter((row) => String(row.title).includes(term)),
      }
      return [kind, service]
    }),
  ) as Record<EntryKind, EntryTransport>

  const initial = useStore.getInitialState()
  const store = createStore<StoreState>(() => ({
    ...initial,
    ...Object.fromEntries(
      Object.keys(services).map((kind) => [
        kind,
        { ...initial[kind as EntityKind], data: [] },
      ]),
    ),
  }))
  const saved = new Map<string, string>()
  if (initialStorage) saved.set('active_tracking_task', initialStorage)
  const storage = {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value)
    },
    removeItem: (key: string) => {
      saved.delete(key)
    },
  }
  const telemetry = createTelemetry({ side: 'frontend' })
  const runtime = createFrontendRuntime(store, {
    services,
    storage,
    transport: stream.transport,
    eventTimeoutMs,
    telemetry,
    now: () => 61001,
  })
  return { runtime, store, services, rows, saved, stream, telemetry }
}

describe('Frontend workflows', () => {
  test('slice operations publish through the same runtime consumed by React', async () => {
    const runtime = getFrontendRuntime(useStore)
    const seen: string[] = []
    const record = (name: string, event: MutationEvent) => {
      if (event.kind === 'tasks') seen.push(`${name}:${event.action}`)
    }
    const offAdd = runtime.events.on('entity.add', (name, event, context) => {
      expect(context.store.getState).toBe(useStore.getState)
      record(name, event)
    })
    const offDelete = runtime.events.on('entity.delete', record)
    try {
      const task = await useStore
        .getState()
        .tasks.add({ title: 'Workflow integration' })
      expect(
        useStore.getState().tasks.data.some((row) => row.id === task.id),
      ).toBe(true)
      await useStore.getState().tasks.remove(task.id)
      expect(seen).toEqual(['entity.add:create', 'entity.delete:delete'])
    } finally {
      offAdd()
      offDelete()
    }
  })

  test('bound Zustand hooks and vanilla API wrappers share one runtime', () => {
    const api = {
      getState: useStore.getState,
      setState: useStore.setState.bind(useStore),
      getInitialState: useStore.getInitialState,
      subscribe: useStore.subscribe,
    }
    expect(getFrontendRuntime(api)).toBe(getFrontendRuntime(useStore))
  })

  test('a command resolves once its events have put the hydrated row in the store', async () => {
    const { runtime, store } = fixture()
    const result = (await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: { title: 'Hydrated' },
    })) as EntryRecord
    expect(store.getState().tasks.data).toHaveLength(1)
    expect(store.getState().tasks.data[0]).toMatchObject({
      id: result.id,
      hydrated: true,
    })
    runtime.dispose()
  })

  test('events from another window update the store without a local command', async () => {
    const { runtime, store, rows, stream } = fixture()
    rows.get('projects')!.set('remote', { id: 'remote', title: 'Remote' })
    const event = {
      kind: 'projects',
      operationId: 'elsewhere',
      result: { id: 'remote', title: 'Remote' },
    }
    await stream.emit('entityCollection.add', { ...event, action: 'create' })
    expect(store.getState().projects.data.map((row) => row.id)).toEqual([
      'remote',
    ])
    await stream.emit('entityCollection.delete', {
      ...event,
      action: 'delete',
      id: 'remote',
    })
    expect(store.getState().projects.data).toEqual([])
    runtime.dispose()
  })

  test('attachment refresh failure warns without failing save; retry performs no write', async () => {
    const { runtime, store, services } = fixture()
    services.tags.fetchPaginated = mock(async () => {
      throw new Error('Read failed')
    })
    const result = (await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: {
        title: 'Saved task',
        tags: [],
      },
    })) as EntryRecord
    expect(store.getState().tasks.data[0].id).toBe(result.id)
    expect(runtime.ui.getState().warnings).toHaveLength(1)
    services.tags.fetchPaginated = mock(async () => [])
    await runtime.ui.getState().warnings[0].retry()
    expect(runtime.ui.getState().warnings).toEqual([])
    expect(services.tasks.create).toHaveBeenCalledTimes(1)
    expect(services.tags.fetchPaginated).toHaveBeenCalledTimes(1)
    runtime.dispose()
  })

  test('failed lifecycle writes retain the session and retry saves time and status together', async () => {
    const { runtime, services, rows, saved } = fixture()
    rows.get('tasks')!.set('one', { id: 'one', title: 'One', spent_minutes: 3 })
    runtime.tracking.start('one', 1000)
    const update = services.tasks.update
    services.tasks.update = mock(async () => {
      throw new Error('Write failed')
    })
    await expect(
      runtime.commands.execute('task.transition', {
        id: 'one',
        status: ProgressStatus.PAUSED,
      }),
    ).rejects.toThrow('Write failed')
    expect(runtime.tracking.getActiveTracking()?.taskId).toBe('one')
    expect(saved.has('active_tracking_task')).toBe(true)
    services.tasks.update = update
    await runtime.commands.execute('task.transition', {
      id: 'one',
      status: ProgressStatus.PAUSED,
    })
    expect(rows.get('tasks')!.get('one')).toMatchObject({
      spent_minutes: 5,
      status: ProgressStatus.PAUSED,
    })
    expect(services.tasks.update).toHaveBeenCalledTimes(1)
    expect(runtime.tracking.getActiveTracking()).toBeNull()
    runtime.dispose()
  })

  test('failed delete retains tracking; successful delete discards it', async () => {
    const { runtime, services, rows } = fixture()
    rows.get('tasks')!.set('one', { id: 'one', title: 'One' })
    runtime.tracking.start('one', 1000)
    const remove = services.tasks.delete
    services.tasks.delete = async () => {
      throw new Error('Delete failed')
    }
    await expect(
      runtime.commands.execute('entity.delete', {
        kind: 'tasks',
        action: 'delete',
        id: 'one',
      }),
    ).rejects.toThrow()
    expect(runtime.tracking.getActiveTracking()?.taskId).toBe('one')
    services.tasks.delete = remove
    await runtime.commands.execute('entity.delete', {
      kind: 'tasks',
      action: 'delete',
      id: 'one',
    })
    expect(runtime.tracking.getActiveTracking()).toBeNull()
    runtime.dispose()
  })

  test('deleting the tracked task elsewhere stops tracking and announces it', async () => {
    const { runtime, stream } = fixture()
    runtime.tracking.start('one', 1000)
    const changes: (string | null)[] = []
    runtime.events.on('tracking.changed', (_name, { taskId }) => {
      changes.push(taskId)
    })
    await stream.emit('tasks.delete', {
      kind: 'tasks',
      action: 'delete',
      id: 'other',
      operationId: 'elsewhere',
      result: { id: 'other' },
    })
    expect(runtime.tracking.getActiveTracking()?.taskId).toBe('one')
    await stream.emit('tasks.delete', {
      kind: 'tasks',
      action: 'delete',
      id: 'one',
      operationId: 'elsewhere',
      result: { id: 'one' },
    })
    expect(runtime.tracking.getActiveTracking()).toBeNull()
    expect(changes).toEqual([null])
    runtime.dispose()
  })

  test('announced member changes reload those rows', async () => {
    const { runtime, store, rows, stream } = fixture()
    rows.get('tasks')!.set('one', { id: 'one', title: 'One', project_id: 'p' })
    await runtime.fetchList('tasks')
    expect(store.getState().tasks.data[0].project_id).toBe('p')

    rows.get('tasks')!.set('one', { id: 'one', title: 'One', project_id: null })
    await stream.emit('tasks.change', {
      kind: 'tasks',
      action: 'update',
      attachedIds: ['one'],
      operationId: 'project-deleted',
      result: undefined,
    })
    expect(store.getState().tasks.data).toHaveLength(1)
    expect(store.getState().tasks.data[0]).toMatchObject({
      id: 'one',
      project_id: null,
      hydrated: true,
    })
    runtime.dispose()
  })

  test('missing events time out into a reload instead of hanging', async () => {
    const { runtime, store, services } = fixture({
      emitEvents: false,
      eventTimeoutMs: 20,
    })
    const result = (await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: { title: 'Event lost' },
    })) as EntryRecord
    expect(services.tasks.fetchPaginated).toHaveBeenCalledTimes(1)
    expect(store.getState().tasks.data.map((row) => row.id)).toEqual([
      result.id,
    ])
    runtime.dispose()
  })

  test('resync reloads active queries and loaded lists', async () => {
    const { runtime, store, rows, stream } = fixture()
    rows.get('tasks')!.set('one', { id: 'one', title: 'Match' })
    await runtime.fetchList('tasks')
    await runtime.search('tasks', 'Match')
    const off = runtime.queries.activate('search:tasks:Match')

    rows.get('tasks')!.set('two', { id: 'two', title: 'Match too' })
    await stream.resync()
    expect(
      (runtime.queries.snapshot('search:tasks:Match').data as EntryRecord[])
        .length,
    ).toBe(2)
    expect(store.getState().tasks.data).toHaveLength(2)
    off()
    runtime.dispose()
  })

  test('concurrent starts serialize, pause the previous task, and retain started_at', async () => {
    const { runtime, rows } = fixture()
    rows.get('tasks')!.set('one', { id: 'one', title: 'One', started_at: 123 })
    rows.get('tasks')!.set('two', { id: 'two', title: 'Two' })
    await Promise.all([
      runtime.commands.execute('task.transition', {
        id: 'one',
        status: ProgressStatus.IN_PROGRESS,
      }),
      runtime.commands.execute('task.transition', {
        id: 'two',
        status: ProgressStatus.IN_PROGRESS,
      }),
    ])
    expect(rows.get('tasks')!.get('one')).toMatchObject({
      status: ProgressStatus.PAUSED,
      started_at: 123,
    })
    expect(rows.get('tasks')!.get('two')?.status).toBe(
      ProgressStatus.IN_PROGRESS,
    )
    expect(runtime.tracking.getActiveTracking()?.taskId).toBe('two')
    runtime.dispose()
  })

  test('restores existing localStorage sessions', () => {
    const { runtime } = fixture({
      initialStorage: JSON.stringify({ taskId: 'restored', startTime: 1000 }),
    })
    expect(runtime.tracking.getActiveTracking()).toEqual({
      taskId: 'restored',
      startTime: 1000,
    })
    runtime.dispose()
  })

  test('Brain Dump loads fallback area and preserves explicit relationships', async () => {
    const { runtime, rows, services } = fixture()
    rows.get('areas')!.set('brain', { id: 'brain', title: 'Brain Dump' })
    await runtime.commands.execute('brainDump.submit', {
      task: { title: 'Unsorted' },
    })
    await runtime.commands.execute('brainDump.submit', {
      task: { title: 'Explicit', project_id: 'project' },
    })
    expect(
      [...rows.get('tasks')!.values()].map((row) => [
        row.area_id,
        row.project_id,
      ]),
    ).toEqual([
      ['brain', undefined],
      [undefined, 'project'],
    ])
    expect(services.areas.fetchPaginated).toHaveBeenCalledTimes(1)
    runtime.dispose()
  })

  test('URL-only partial submission returns only failed inputs for retry', async () => {
    const { runtime, services } = fixture()
    const create = services.urls.create
    let fails = true
    services.urls.create = mock(
      async (input: Record<string, unknown>, options?: MutationOptions) => {
        if (input.url === 'https://failed.example' && fails)
          throw new Error('Unavailable')
        return create(input, options)
      },
    )
    const result = await runtime.commands.execute('brainDump.submit', {
      urls: [
        { url: 'https://saved.example' },
        { url: 'https://failed.example' },
      ],
    })
    expect(result.failedUrls).toEqual([{ url: 'https://failed.example' }])
    fails = false
    await runtime.commands.execute('brainDump.submit', {
      urls: result.failedUrls,
    })
    expect(create).toHaveBeenCalledTimes(2)
    runtime.dispose()
  })

  test('active search membership refreshes after a mutation without observing store arrays', async () => {
    const { runtime, rows } = fixture()
    rows.get('tasks')!.set('one', { id: 'one', title: 'Match' })
    await runtime.search('tasks', 'Match')
    const key = 'search:tasks:Match'
    const off = runtime.queries.activate(key)
    await runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id: 'one',
      changes: { title: 'Other' },
    })
    expect(runtime.queries.snapshot(key).data).toEqual([])
    off()
    runtime.dispose()
  })

  describe('telemetry', () => {
    const named = (spans: Span[], name: string) =>
      spans.find((span) => span.name === name)!

    test('a mutation traces command, request, events and reactions under one id', async () => {
      const { runtime, telemetry } = fixture()
      await runtime.commands.execute('entity.add', {
        kind: 'tasks',
        action: 'create',
        changes: { title: 'Traced' },
      })
      const [command] = telemetry.recent({ kind: 'command' })
      const spans = telemetry.recent({ traceId: command.traceId })
      expect(command).toMatchObject({
        name: 'entity.add',
        status: 'ok',
        attrs: { kind: 'tasks' },
      })
      // The operationId stays unique per request; its events join this trace.
      expect(typeof command.attrs?.operationId).toBe('string')
      for (const name of ['stream.ready', 'events.settle'])
        expect(named(spans, name).parentId).toBe(command.spanId)
      expect(spans.find((span) => span.kind === 'http')?.parentId).toBe(
        command.spanId,
      )
      const familyEvent = spans.find(
        (span) => span.kind === 'event' && span.name === 'entity.add',
      )!
      expect(familyEvent.parentId).toBe(command.spanId)
      const listener = spans.find(
        (span) =>
          span.kind === 'listener' && span.parentId === familyEvent.spanId,
      )!
      expect(listener.name).toBe('reactions')
      expect(
        spans
          .filter((span) => span.kind === 'reaction')
          .filter((span) => span.parentId === listener.spanId)
          .map((span) => span.name),
      ).toEqual(['upsertRows', 'invalidateDependents'])
      expect(spans.filter((span) => span.status === 'error')).toEqual([])
      runtime.dispose()
    })

    test('nested commands join the parent trace', async () => {
      const { runtime, rows, telemetry } = fixture()
      rows.get('tasks')!.set('one', { id: 'one', title: 'One' })
      await runtime.commands.execute('entity.change', {
        kind: 'tasks',
        action: 'update',
        id: 'one',
        changes: { status: ProgressStatus.COMPLETED },
      })
      const commands = telemetry.recent({ kind: 'command' })
      expect(commands.map((span) => span.name)).toEqual([
        'entity.change',
        'task.transition',
        'entity.change',
      ])
      // Spans are recorded when they end, so the innermost comes first.
      const [inner, transition, outer] = commands
      expect(transition.parentId).toBe(outer.spanId)
      expect(inner.parentId).toBe(transition.spanId)
      expect(new Set(commands.map((span) => span.traceId)).size).toBe(1)
      expect(
        telemetry.recent({ traceId: outer.traceId, kind: 'reaction' }).length,
      ).toBeGreaterThan(0)
      runtime.dispose()
    })

    test('lost events emit an events.timeout signal in the command trace', async () => {
      const { runtime, telemetry } = fixture({
        emitEvents: false,
        eventTimeoutMs: 20,
      })
      await runtime.commands.execute('entity.add', {
        kind: 'tasks',
        action: 'create',
        changes: { title: 'Event lost' },
      })
      const [command] = telemetry.recent({ kind: 'command' })
      const [timeout] = telemetry.recent({ kind: 'signal' })
      expect(timeout).toMatchObject({
        name: 'events.timeout',
        traceId: command.traceId,
        attrs: { command: 'entity.add', kind: 'tasks', timeoutMs: 20 },
      })
      expect(named(telemetry.recent(), 'events.settle').attrs?.settled).toBe(
        false,
      )
      runtime.dispose()
    })

    test('a throwing reaction is an error span; the command still resolves', async () => {
      const { runtime, rows, saved, telemetry } = fixture()
      rows.get('tasks')!.set('one', { id: 'one', title: 'One' })
      runtime.tracking.start('one', 1000)
      saved.delete = () => {
        throw new Error('Storage unavailable')
      }
      await runtime.commands.execute('entity.delete', {
        kind: 'tasks',
        action: 'delete',
        id: 'one',
      })
      const [failed] = telemetry.recent({ kind: 'reaction', status: 'error' })
      expect(failed).toMatchObject({
        name: 'stopTrackingIfDeleted',
        error: { message: 'Storage unavailable' },
      })
      expect(failed.traceId).toBe(
        telemetry.recent({ kind: 'command' })[0].traceId,
      )
      expect(telemetry.recent({ kind: 'command' })[0].status).toBe('ok')
      runtime.dispose()
    })

    test('resyncs, refresh failures and loads are recorded', async () => {
      const { runtime, services, stream, telemetry } = fixture()
      await runtime.fetchList('tasks')
      expect(named(telemetry.recent(), 'list:tasks').kind).toBe('query')

      await stream.resync()
      expect(named(telemetry.recent(), 'stream.resync').kind).toBe('signal')

      services.tags.fetchPaginated = mock(async () => {
        throw new Error('Read failed')
      })
      await runtime.commands.execute('entity.add', {
        kind: 'tasks',
        action: 'create',
        changes: { title: 'Saved task', tags: [] },
      })
      expect(named(telemetry.recent(), 'refresh.failed')).toMatchObject({
        status: 'error',
        attrs: { key: 'list:tags' },
        traceId: telemetry.recent({ kind: 'command' })[0].traceId,
      })
      runtime.dispose()
    })
  })
})
