import { describe, expect, mock, test } from 'bun:test'
import { createStore } from 'zustand/vanilla'
import {
  createFrontendRuntime,
  getFrontendRuntime,
  type EntryTransport,
} from '@/workflows/runtime'
import { useStore, type StoreState } from '@/store'
import { ProgressStatus } from '@c/types'
import type { EntityKind, EntryKind, EntryRecord } from '@c/workflows/contracts'

function fixture(initialStorage?: string) {
  const rows = new Map<EntryKind, Map<string, EntryRecord>>()
  const services = Object.fromEntries(
    (
      [
        'tasks',
        'projects',
        'areas',
        'goals',
        'resources',
        'tags',
        'urls',
        'time_entries',
      ] as const
    ).map((kind) => {
      const data = new Map<string, EntryRecord>()
      rows.set(kind, data)
      const service: EntryTransport = {
        create: mock(async (changes: Record<string, unknown>) => {
          const row = { id: crypto.randomUUID(), ...changes }
          data.set(row.id, row)
          return row
        }),
        update: mock(async (id: string, changes: Record<string, unknown>) => {
          const previous = data.get(id)
          if (!previous) throw new Error('Missing entity')
          const row = { ...previous, ...changes }
          data.set(id, row)
          return row
        }),
        delete: mock(async (id: string) => {
          const row = data.get(id)
          if (!row) throw new Error('Missing entity')
          data.delete(id)
          return row
        }),
        reset: async () => {
          const deleted = data.size
          data.clear()
          return { deleted }
        },
        fetchPaginated: mock(async () => [...data.values()]),
        fetchById: async (id) => {
          const row = data.get(id)
          if (!row) throw new Error('Missing entity')
          return row
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
  const runtime = createFrontendRuntime(store, {
    services,
    storage,
    now: () => 61001,
  })
  return { runtime, store, services, rows, saved }
}

describe('Frontend workflows', () => {
  test('slice operations publish through the same runtime consumed by React', async () => {
    const runtime = getFrontendRuntime(useStore)
    const seen: string[] = []
    const off = runtime.events.on('entry.changed', (event, context) => {
      expect(context.store.getState).toBe(useStore.getState)
      if (event.kind === 'tasks') seen.push(event.action)
    })
    try {
      const task = await useStore
        .getState()
        .tasks.add({ title: 'Workflow integration' })
      await useStore.getState().tasks.remove(task.id)
      expect(seen).toEqual(['create', 'delete'])
    } finally {
      off()
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

  test('attachment refresh failure warns without failing save; retry performs no write', async () => {
    const { runtime, store, services } = fixture()
    services.tags.fetchPaginated = mock(async () => {
      throw new Error('Read failed')
    })
    const result = (await runtime.commands.execute('entry.mutate', {
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
      runtime.commands.execute('entry.mutate', {
        kind: 'tasks',
        action: 'delete',
        id: 'one',
      }),
    ).rejects.toThrow()
    expect(runtime.tracking.getActiveTracking()?.taskId).toBe('one')
    services.tasks.delete = remove
    await runtime.commands.execute('entry.mutate', {
      kind: 'tasks',
      action: 'delete',
      id: 'one',
    })
    expect(runtime.tracking.getActiveTracking()).toBeNull()
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
    const { runtime } = fixture(
      JSON.stringify({ taskId: 'restored', startTime: 1000 }),
    )
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
    services.urls.create = mock(async (input: Record<string, unknown>) => {
      if (input.url === 'https://failed.example' && fails)
        throw new Error('Unavailable')
      return create(input)
    })
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
    await runtime.commands.execute('entry.mutate', {
      kind: 'tasks',
      action: 'update',
      id: 'one',
      changes: { title: 'Other' },
    })
    expect(runtime.queries.snapshot(key).data).toEqual([])
    off()
    runtime.dispose()
  })
})
