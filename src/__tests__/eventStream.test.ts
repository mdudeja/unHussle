import { describe, expect, test } from 'bun:test'
import {
  createEventSourceTransport,
  createSseTransport,
  type EventHandlers,
} from '@/workflows/eventStream'

/** Builds a server-sent event frame containing an identifier and JSON-encoded event data. */
const frame = (id: number, name: string, payload: unknown = {}) =>
  `id: ${id}\ndata: ${JSON.stringify({ name, payload })}\n\n`

/** Records events as they occur, capturing the start and end of named events and any resynchronization events. */
const recorder = (delayMs = 0) => {
  const seen: string[] = []
  const handlers: EventHandlers = {
    /** Records the start and end of a named event. */
    async onEvent(name) {
      seen.push(`start ${name}`)
      if (delayMs) await new Promise((done) => setTimeout(done, delayMs))
      seen.push(`end ${name}`)
    },
    /** Records that a resynchronization event has occurred. */
    onResync() {
      seen.push('resync')
    },
  }
  return { seen, handlers }
}

/** Waits briefly before resolving, allowing pending asynchronous work to settle. */
const settle = () => new Promise((done) => setTimeout(done, 20))

/** A fake source that simulates a server-sent events connection for testing event handlers and connection state. */
class FakeSource {
  readyState = 0
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent<string>) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  closed = false
  /** Creates a fake source instance associated with the specified URL. */
  constructor(readonly url: string) {}
  /** Opens the connection and notifies listeners that it is ready. */
  open() {
    this.readyState = 1
    this.onopen?.(new Event('open'))
  }
  /** Emits a message event to notify the registered message handler with the supplied message details. */
  emit(id: number, name: string, payload: unknown = {}) {
    this.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({ name, payload }),
        lastEventId: String(id),
      }),
    )
  }
  /** Marks the operation as failed with the specified ready state and notifies any error handler. */
  fail(readyState: number) {
    this.readyState = readyState
    this.onerror?.(new Event('error'))
  }
  /** Marks the connection as closed and updates its status accordingly. */
  close() {
    this.closed = true
    this.readyState = 2
  }
}

describe('EventSource transport', () => {
  /** Sets up a fake event source transport and tracks the sources it creates for testing. */
  const setup = () => {
    const sources: FakeSource[] = []
    const transport = createEventSourceTransport({
      url: 'http://test/events',
      retryMs: 5,
      createSource: (url) => {
        const source = new FakeSource(url)
        sources.push(source)
        return source
      },
    })
    return { sources, transport }
  }

  test('is ready once open and handles events one at a time, in order', async () => {
    const { sources, transport } = setup()
    const { seen, handlers } = recorder(5)
    transport.connect(handlers)
    let ready = false
    void transport.ready().then(() => (ready = true))
    await settle()
    expect(ready).toBe(false)

    sources[0].open()
    await settle()
    expect(ready).toBe(true)

    sources[0].emit(1, 'entity.add')
    sources[0].emit(2, 'tasks.add')
    sources[0].emit(3, 'resync')
    await settle()
    expect(seen).toEqual([
      'start entity.add',
      'end entity.add',
      'start tasks.add',
      'end tasks.add',
      'resync',
    ])
    transport.close()
  })

  test('a reconnect without an id resyncs; a closed source reopens from its last id', async () => {
    const { sources, transport } = setup()
    const { seen, handlers } = recorder()
    transport.connect(handlers)
    sources[0].open()

    // The source retries by itself (CONNECTING); nothing was received yet.
    sources[0].fail(0)
    sources[0].open()
    await settle()
    expect(seen).toEqual(['resync'])
    expect(sources).toHaveLength(1)

    sources[0].emit(7, 'entity.add')
    sources[0].fail(2)
    await settle()
    expect(sources).toHaveLength(2)
    expect(sources[1].url).toBe('http://test/events?lastEventId=7')
    sources[1].open()
    await settle()
    expect(seen).toEqual(['resync', 'start entity.add', 'end entity.add'])

    transport.close()
    expect(sources[1].closed).toBe(true)
  })
})

describe('fetch transport', () => {
  test('parses unnamed frames, including ones split across chunks', async () => {
    const encoder = new TextEncoder()
    const text = `retry: 2000\n\n${frame(1, 'entity.add', { operationId: 'op' })}${frame(2, 'resync')}`
    const cut = text.indexOf('"op"')
    const fetchImpl = (async () =>
      new Response(
        new ReadableStream({
          /** Starts the stream by enqueueing the text split at the configured cut position. */
          start(controller) {
            controller.enqueue(encoder.encode(text.slice(0, cut)))
            controller.enqueue(encoder.encode(text.slice(cut)))
          },
        }),
        { headers: { 'Content-Type': 'text/event-stream' } },
      )) as unknown as typeof fetch
    const transport = createSseTransport({
      url: 'http://test/events',
      fetchImpl,
      retryMs: 60_000,
    })
    const payloads: unknown[] = []
    const { seen, handlers } = recorder()
    transport.connect({
      onEvent: (name, payload) => {
        payloads.push(payload)
        return handlers.onEvent(name, payload)
      },
      onResync: () => handlers.onResync(),
    })
    await transport.ready()
    await settle()
    expect(seen).toEqual(['start entity.add', 'end entity.add', 'resync'])
    expect(payloads).toEqual([{ operationId: 'op' }])
    transport.close()
  })
})
