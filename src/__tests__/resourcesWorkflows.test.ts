import { describe, expect, test } from 'bun:test'
import { createStore } from 'zustand/vanilla'
import { createFrontendRuntime, type EntryTransport } from '@/workflows/runtime'
import type { EventHandlers } from '@/workflows/eventStream'
import type { VaultTransport } from '@/services/vault'
import { useStore, type StoreState } from '@/store'
import type { EntryKind, EntryRecord } from '@c/workflows/contracts'
import type { VaultCommands } from '@c/vault/contracts'
import { vaultCommandEvents } from '@c/vault/contracts'
import { createTelemetry } from '@c/workflows/telemetry'

const kinds: EntryKind[] = [
  'tasks',
  'projects',
  'areas',
  'goals',
  'resources',
  'tags',
  'urls',
  'time_entries',
]

/** Fake backend: rows per kind, a vault, and an event stream it emits on. */
function fixture({ emit = true } = {}) {
  let handlers: EventHandlers | undefined
  const rows = Object.fromEntries(
    kinds.map((kind) => [kind, new Map<string, EntryRecord>()]),
  ) as Record<EntryKind, Map<string, EntryRecord>>
  const fetched: string[] = []
  const contentReads: string[] = []
  const saves: VaultCommands['resource.content.save']['input'][] = []

  const services = Object.fromEntries(
    kinds.map((kind) => {
      const service: EntryTransport = {
        create: async () => ({ id: 'unused' }),
        update: async () => ({ id: 'unused' }),
        delete: async () => ({ id: 'unused' }),
        reset: async () => ({}),
        fetchPaginated: async () => {
          fetched.push(`list:${kind}`)
          return [...rows[kind].values()]
        },
        fetchById: async (id) => {
          fetched.push(`${kind}:${id}`)
          const row = rows[kind].get(id)
          if (!row) throw new Error('Missing entity')
          return { ...row }
        },
        search: async () => [],
      }
      return [kind, service]
    }),
  ) as Record<EntryKind, EntryTransport>

  const vault: VaultTransport = {
    info: async () => ({
      path: '/vault',
      source: 'default',
      resources: rows.resources.size,
      missing: 0,
    }),
    content: async (id) => {
      contentReads.push(id)
      return {
        id,
        content: '# Note',
        content_hash: 'h1',
        missing: false,
        path: `/vault/${id}.md`,
      }
    },
    execute: async <K extends keyof VaultCommands>(
      name: K,
      input: VaultCommands[K]['input'],
      options: { operationId?: string },
    ): Promise<VaultCommands[K]['result']> => {
      const event = vaultCommandEvents[name]
      let result: unknown
      if (name === 'resource.content.save') {
        const save = input as VaultCommands['resource.content.save']['input']
        saves.push(save)
        const row = rows.resources.get(save.id)
        if (row) rows.resources.set(save.id, { ...row, content_hash: 'h2' })
        result = { id: save.id, content_hash: 'h2', updated_at: 2 }
      } else if (name === 'vault.rescan') {
        rows.resources.set('imported', { id: 'imported', title: 'Imported' })
        result = { imported: 1, repaired: 0, missing: [] }
      }
      if (emit)
        setTimeout(() => {
          void handlers?.onEvent(event, {
            operationId: options.operationId,
            ...('id' in input ? { id: input.id } : {}),
          })
        }, 0)
      return result as VaultCommands[K]['result']
    },
  }

  const initial = useStore.getInitialState()
  const store = createStore<StoreState>(() => initial)
  const runtime = createFrontendRuntime(store, {
    services,
    vault,
    eventTimeoutMs: 20,
    transport: {
      connect: (next) => {
        handlers = next
      },
      ready: () => Promise.resolve(),
      close: () => {
        handlers = undefined
      },
    },
    telemetry: createTelemetry({ side: 'frontend' }),
  })
  /** Provides a namespaced key for identifying content resources. */
  const contentKey = (id: string) => `content:resources:${id}`
  /** Watches content so that it is loaded and made available through the runtime’s query system. */
  const watchContent = (id: string) => {
    runtime.queries.define({
      key: contentKey(id),
      dependencies: ['resourceContent'],
      load: () => vault.content(id),
    })
    runtime.queries.activate(contentKey(id))
    return runtime.queries.ensure(contentKey(id))
  }
  /** Emits a named event with its associated payload to the configured event handlers. */
  const emitEvent = (name: string, payload: unknown) =>
    handlers?.onEvent(name, payload)
  return {
    runtime,
    store,
    rows,
    fetched,
    contentReads,
    saves,
    watchContent,
    emitEvent,
  }
}

describe('resource workflows', () => {
  test('a content save waits for its event and reloads the stored row', async () => {
    const f = fixture()
    f.rows.resources.set('r1', { id: 'r1', title: 'Doc', content_hash: 'h1' })
    await f.runtime.ensureList('resources')

    const result = await f.runtime.commands.execute('resource.content.save', {
      id: 'r1',
      content: '# Changed',
      baseHash: 'h1',
    })
    expect(result.content_hash).toBe('h2')
    expect(f.saves).toEqual([
      { id: 'r1', content: '# Changed', baseHash: 'h1' },
    ])
    expect(f.fetched).toContain('resources:r1')
    expect(
      (f.store.getState().resources.data as EntryRecord[])[0].content_hash,
    ).toBe('h2')
    f.runtime.dispose()
  })

  test('without its event, a save rereads open content instead', async () => {
    const f = fixture({ emit: false })
    f.rows.resources.set('r1', { id: 'r1', title: 'Doc' })
    await f.watchContent('r1')
    expect(f.contentReads).toEqual(['r1'])

    await f.runtime.commands.execute('resource.content.save', {
      id: 'r1',
      content: 'x',
    })
    expect(f.contentReads).toEqual(['r1', 'r1'])
    f.runtime.dispose()
  })

  test('saves of one resource are sent one at a time, in order', async () => {
    const f = fixture()
    f.rows.resources.set('r1', { id: 'r1', title: 'Doc' })
    await Promise.all(
      ['a', 'b', 'c'].map((content) =>
        f.runtime.commands.execute('resource.content.save', {
          id: 'r1',
          content,
        }),
      ),
    )
    expect(f.saves.map((save) => save.content)).toEqual(['a', 'b', 'c'])
    f.runtime.dispose()
  })

  test('a rescan reloads the resource list', async () => {
    const f = fixture()
    await f.runtime.ensureList('resources')
    expect(f.store.getState().resources.data).toEqual([])

    await f.runtime.commands.execute('vault.rescan', {})
    expect(
      (f.store.getState().resources.data as EntryRecord[]).map((r) => r.id),
    ).toEqual(['imported'])
    f.runtime.dispose()
  })

  test('announced areas reload, so linked resources show up on them', async () => {
    const f = fixture()
    f.rows.areas.set('a1', { id: 'a1', title: 'Health', count_resources: 0 })
    await f.runtime.ensureList('areas')
    f.rows.areas.set('a1', { id: 'a1', title: 'Health', count_resources: 1 })

    await f.emitEvent('areas.change', {
      kind: 'areas',
      action: 'update',
      attachedIds: ['a1'],
      operationId: 'elsewhere',
    })
    expect(
      (f.store.getState().areas.data as EntryRecord[])[0].count_resources,
    ).toBe(1)
    f.runtime.dispose()
  })
})
