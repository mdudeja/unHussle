import { Logger } from '@c/Logger'
import type { Telemetry } from '@c/workflows/telemetry'

export type EventHandlers = {
  onEvent(name: string, payload: unknown): void | Promise<void>
  /** Events may have been missed; derived state must be reloaded. */
  onResync(): void | Promise<void>
}

/** Delivers backend events to the frontend runtime, one at a time and in order. */
export type EventTransport = {
  connect(handlers: EventHandlers): void
  /** Resolves while connected; commands wait on it so their events are not missed. */
  ready(): Promise<void>
  close(): void
}

type Frame = { id?: string; event: string; data: string; retry?: number }

/** Parses complete SSE frames out of `buffer`, returning the unparsed remainder. */
export function parseFrames(buffer: string): { frames: Frame[]; rest: string } {
  const normalized = buffer.replace(/\r\n?/g, '\n')
  const blocks = normalized.split('\n\n')
  const rest = blocks.pop() ?? ''
  const frames: Frame[] = []
  for (const block of blocks) {
    const frame: Frame = { event: 'message', data: '' }
    const data: string[] = []
    let hasField = false
    for (const line of block.split('\n')) {
      if (!line || line.startsWith(':')) continue
      const colon = line.indexOf(':')
      const field = colon === -1 ? line : line.slice(0, colon)
      const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '')
      hasField = true
      if (field === 'event') frame.event = value
      else if (field === 'data') data.push(value)
      else if (field === 'id') frame.id = value
      else if (field === 'retry' && /^\d+$/.test(value))
        frame.retry = Number(value)
    }
    if (!hasField) continue
    frame.data = data.join('\n')
    frames.push(frame)
  }
  return { frames, rest }
}

/** Creates a promise that can be resolved externally at a later time. */
const deferred = () => {
  /** Resolves the pending operation. */
  let resolve = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

/** Provides the default URL for the local events endpoint. */
const defaultUrl = () =>
  `http://localhost:${import.meta.env.VITE_DB_SERVER_PORT}/events`

/** A frame's data: the backend event name and its payload. */
type WireEvent = { name: string; payload: unknown }

/** Dispatches incoming wire events to the appropriate handler, routing resync messages to the resync handler and other events to the event handler. */
const dispatch = async (handlers: EventHandlers, data: string) => {
  const { name, payload } = JSON.parse(data) as WireEvent
  if (name === 'resync') await handlers.onResync()
  else await handlers.onEvent(name, payload)
}

/**
 * Picks the client for the runtime: `EventSource` where it exists (the
 * webview), `fetch` under Bun, which has no `EventSource`.
 */
export const createEventTransport = (options: { telemetry?: Telemetry } = {}) =>
  typeof EventSource === 'undefined'
    ? createSseTransport(options)
    : createEventSourceTransport(options)

type EventSourceLike = {
  readonly readyState: number
  onopen: ((event: Event) => void) | null
  onmessage: ((event: MessageEvent<string>) => void) | null
  onerror: ((event: Event) => void) | null
  close(): void
}

/** `EventSource.CLOSED`: the source gave up and will not reconnect by itself. */
const CLOSED = 2

/**
 * SSE client built on `EventSource`, for the webview. WebKitGTK (the Tauri
 * webview on Linux) holds back the end of a streamed `fetch` body until more
 * bytes arrive, so the last frame of every burst would wait for the next
 * action; its `EventSource` delivers each frame as it comes.
 *
 * The source reconnects by itself and sends `Last-Event-ID`. When it gives up
 * (a non-200 answer), a new one is opened with the id as a query parameter.
 */
export function createEventSourceTransport({
  url = defaultUrl(),
  createSource = (target) => new EventSource(target),
  retryMs = 2000,
  telemetry,
}: {
  url?: string
  createSource?: (url: string) => EventSourceLike
  retryMs?: number
  telemetry?: Telemetry
} = {}): EventTransport {
  const logger = Logger.getInstance()
  let closed = false
  let started = false
  let opened = false
  let lastEventId: string | undefined
  let connection = deferred()
  let connected = false
  let source: EventSourceLike | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  // `EventSource` fires synchronously; handlers still run one at a time, in order.
  let queue = Promise.resolve()

  /** Schedules a task to run after previously enqueued tasks complete, ensuring failures are logged without interrupting the queue. */
  const enqueue = (task: () => void | Promise<void>) => {
    queue = queue.then(task).catch((error: unknown) => {
      logger.error('Event handling failed', { error })
    })
  }

  /** Disconnects the current connection and resets its state so a new connection can be established. */
  const disconnect = () => {
    if (connected) connection = deferred()
    connected = false
  }

  /** Establishes and maintains an event stream connection, delivering incoming messages and recovering from disconnects. */
  const open = (handlers: EventHandlers) => {
    const target = lastEventId
      ? `${url}${url.includes('?') ? '&' : '?'}lastEventId=${encodeURIComponent(lastEventId)}`
      : url
    const current = createSource(target)
    source = current
    current.onopen = () => {
      if (opened) {
        telemetry?.signal('stream.reconnect', {
          lastEventId: lastEventId ?? 'none',
        })
        // Without an id the server cannot replay, so a reconnect must resync.
        if (!lastEventId) enqueue(() => handlers.onResync())
      }
      opened = true
      connected = true
      connection.resolve()
    }
    current.onmessage = (event) => {
      if (event.lastEventId) lastEventId = event.lastEventId
      if (event.data) enqueue(() => dispatch(handlers, event.data))
    }
    current.onerror = () => {
      disconnect()
      if (closed || current.readyState !== CLOSED) return
      logger.debug('Event stream closed; reopening')
      retry = setTimeout(() => {
        if (!closed) open(handlers)
      }, retryMs)
    }
  }

  return {
    /** Starts the connection and begins dispatching events to the provided handlers, ensuring it only starts once and not after closure. */
    connect(handlers) {
      if (started || closed) return
      started = true
      open(handlers)
    },
    ready: () => connection.promise,
    /** Closes the connection and stops any pending retry or reconnection activity. */
    close() {
      closed = true
      clearTimeout(retry)
      source?.close()
      disconnect()
    },
  }
}

/**
 * SSE client built on `fetch`, for the Bun runtime, which has no
 * `EventSource`; the store tests run it under `bun test` against the real
 * stream. Reconnects with `Last-Event-ID` so the server can replay missed
 * events, or asks for a resync when it cannot.
 */
export function createSseTransport({
  url = defaultUrl(),
  fetchImpl = fetch,
  retryMs = 2000,
  telemetry,
}: {
  url?: string
  fetchImpl?: typeof fetch
  retryMs?: number
  telemetry?: Telemetry
} = {}): EventTransport {
  const logger = Logger.getInstance()
  let closed = false
  let started = false
  let lastEventId: string | undefined
  let delay = retryMs
  let connection = deferred()
  let connected = false
  let abort: AbortController | undefined

  /** Disconnects the current connection and clears its active state so it can be re-established later. */
  const disconnect = () => {
    if (connected) connection = deferred()
    connected = false
  }

  /** Maintains a resilient server-sent event stream connection, dispatching incoming events to handlers and reconnecting after disconnections. */
  const run = async (handlers: EventHandlers) => {
    let opened = false
    while (!closed) {
      abort = new AbortController()
      try {
        const response = await fetchImpl(url, {
          headers: {
            Accept: 'text/event-stream',
            ...(lastEventId ? { 'Last-Event-ID': lastEventId } : {}),
          },
          signal: abort.signal,
        })
        if (!response.ok || !response.body)
          throw new Error(`Event stream unavailable (${response.status})`)

        if (opened)
          telemetry?.signal('stream.reconnect', {
            lastEventId: lastEventId ?? 'none',
          })
        // Without an id the server cannot replay, so a reconnect must resync.
        if (opened && !lastEventId) await handlers.onResync()
        opened = true
        connected = true
        connection.resolve()

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          const parsed = parseFrames(
            buffer + decoder.decode(value, { stream: true }),
          )
          buffer = parsed.rest
          for (const frame of parsed.frames) {
            if (frame.retry !== undefined) delay = frame.retry
            if (frame.id) lastEventId = frame.id
            if (frame.event === 'message' && frame.data)
              await dispatch(handlers, frame.data)
          }
        }
      } catch (error) {
        if (closed) break
        logger.debug('Event stream disconnected', { error })
      }
      disconnect()
      if (!closed) await new Promise((done) => setTimeout(done, delay))
    }
  }

  return {
    /** Starts handling events with the provided handlers if the connection has not already started or been closed. */
    connect(handlers) {
      if (started || closed) return
      started = true
      void run(handlers)
    },
    ready: () => connection.promise,
    /** Closes the connection and aborts any ongoing operation. */
    close() {
      closed = true
      abort?.abort()
      disconnect()
    },
  }
}
