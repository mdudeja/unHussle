import { beforeAll, describe, expect, test } from 'bun:test'
import { Elysia } from 'elysia'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { createBackendRuntime } from '@d/workflows/runtime'
import {
  createEventForwarder,
  createEventRoutes,
  type EventFrame,
} from '@d/routes/events'

describe('Backend event stream', () => {
  const database = new UnHussleDB(':memory:')
  beforeAll(async () => {
    await database.getDb()
  })

  /** Creates a new task in the backend. */
  const addTask = (
    runtime: ReturnType<typeof createBackendRuntime>,
    title: string,
    operationId?: string,
  ) =>
    runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      operationId,
      changes: { title },
    })

  test('onAny sees every event and the client operationId is kept', async () => {
    const runtime = createBackendRuntime(database)
    const seen: [string, unknown][] = []
    runtime.events.onAny((name, payload) => {
      seen.push([name, payload.operationId])
    })
    await addTask(runtime, 'Any listener', 'op-any')
    expect(seen).toEqual([
      ['entity.add', 'op-any'],
      ['tasks.add', 'op-any'],
    ])
    runtime.dispose()
  })

  test('forwarder numbers frames, replays missed ones and requests resync past the buffer', async () => {
    const runtime = createBackendRuntime(database)
    const forwarder = createEventForwarder(runtime, { bufferSize: 3 })
    const live: EventFrame[] = []
    const { unsubscribe } = forwarder.subscribe((frame) => live.push(frame))

    await addTask(runtime, 'Frame one')
    await addTask(runtime, 'Frame two')
    expect(live.map((frame) => [frame.id, frame.name])).toEqual([
      [1, 'entity.add'],
      [2, 'tasks.add'],
      [3, 'entity.add'],
      [4, 'tasks.add'],
    ])
    unsubscribe()

    /** Obtains the IDs of events available for replay, or indicates that a full resynchronization is required. */
    const ids = (lastEventId?: number) => {
      const { replay, unsubscribe } = forwarder.subscribe(() => {}, lastEventId)
      unsubscribe()
      return replay === 'resync' ? replay : replay.map((frame) => frame.id)
    }
    expect(ids()).toEqual([])
    expect(ids(4)).toEqual([])
    expect(ids(2)).toEqual([3, 4])
    expect(ids(1)).toEqual([2, 3, 4])
    // Frame 1 has left the 3-frame buffer, and unknown ids mean a restarted server.
    expect(ids(0)).toBe('resync')
    expect(ids(99)).toBe('resync')

    forwarder.dispose()
    runtime.dispose()
  })

  test('GET /events streams framed events', async () => {
    const runtime = createBackendRuntime(database)
    const forwarder = createEventForwarder(runtime)
    const app = createEventRoutes(forwarder)
    const abort = new AbortController()
    const response = await app.handle(
      new Request('http://localhost/events', { signal: abort.signal }),
    )
    expect(response.headers.get('content-type')).toBe('text/event-stream')

    await addTask(runtime, 'Streamed', 'op-stream')

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (!text.includes('"name":"tasks.add"')) {
      const { value, done } = await reader.read()
      if (done) break
      text += decoder.decode(value)
    }
    abort.abort()

    expect(text).toContain('retry: 2000')
    expect(text).toContain('id: 1\ndata: {"name":"entity.add","payload":{')
    expect(text).toContain('"operationId":"op-stream"')
    expect(text).toContain('id: 2\ndata: {"name":"tasks.add"')
    expect(text).not.toContain('event:')
    forwarder.dispose()
    runtime.dispose()
  })

  test('GET /events replays from a lastEventId query parameter', async () => {
    const runtime = createBackendRuntime(database)
    const forwarder = createEventForwarder(runtime)
    const app = createEventRoutes(forwarder)
    await addTask(runtime, 'Before reopen', 'op-before')

    const abort = new AbortController()
    const response = await app.handle(
      new Request('http://localhost/events?lastEventId=1', {
        signal: abort.signal,
      }),
    )
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let text = ''
    while (!text.includes('"name":"tasks.add"')) {
      const { value, done } = await reader.read()
      if (done) break
      text += decoder.decode(value)
    }
    abort.abort()

    expect(text).not.toContain('id: 1\n')
    expect(text).toContain('id: 2\ndata: {"name":"tasks.add"')
    forwarder.dispose()
    runtime.dispose()
  })

  test('a silent stream outlives the server idle timeout', async () => {
    const runtime = createBackendRuntime(database)
    const forwarder = createEventForwarder(runtime)
    /** Creates a silent server-sent events response that instructs the client to retry after two seconds and emits no events. */
    const silent = () =>
      new Response(
        new ReadableStream({
          /** Initializes the event stream by instructing the client to retry after 2000 milliseconds. */
          start(controller) {
            controller.enqueue(new TextEncoder().encode('retry: 2000\n\n'))
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      )
    // 1s idle timeout instead of the default, so the test stays fast.
    const app = new Elysia({ serve: { idleTimeout: 1 } })
      .use(createEventRoutes(forwarder))
      .get('/control', silent)
      .listen(0)
    const base = `http://localhost:${app.server!.port}`

    /** Reads a response body incrementally until the specified marker is encountered, capturing the text received up to that point. */
    const readUntil = async (path: string, marker: string) => {
      const response = await fetch(`${base}${path}`)
      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let text = ''
      try {
        while (!text.includes(marker)) {
          const { value, done } = await reader.read()
          if (done) return { text, closed: true }
          text += decoder.decode(value)
        }
        return { text, closed: false }
      } catch {
        // A server-side idle close surfaces as ECONNRESET.
        return { text, closed: true }
      } finally {
        void reader.cancel().catch(() => {})
      }
    }

    // Control: without the per-request override the server drops the stream.
    expect((await readUntil('/control', 'never sent')).closed).toBe(true)

    const events = readUntil('/events', '"name":"tasks.add"')
    await new Promise((done) => setTimeout(done, 2500))
    await addTask(runtime, 'After idle', 'op-idle')
    const { text, closed } = await events
    expect(closed).toBe(false)
    expect(text).toContain('"operationId":"op-idle"')

    await app.stop(true)
    forwarder.dispose()
    runtime.dispose()
  }, 15000)
})
