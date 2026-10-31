import { Logger } from '@c/Logger'

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

const deferred = () => {
  let resolve = () => {}
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

/**
 * SSE client built on `fetch`. Browsers (and the Tauri webview) have
 * `EventSource`, but the Bun runtime does not, and the store tests run this
 * client under `bun test` against the real stream. `fetch` behaves the same in
 * both. Reconnects with `Last-Event-ID` so the server can replay missed events,
 * or asks for a resync when it cannot.
 */
export function createSseTransport({
  url = `http://localhost:${import.meta.env.VITE_DB_SERVER_PORT}/events`,
  fetchImpl = fetch,
  retryMs = 2000,
}: {
  url?: string
  fetchImpl?: typeof fetch
  retryMs?: number
} = {}): EventTransport {
  const logger = Logger.getInstance()
  let closed = false
  let started = false
  let lastEventId: string | undefined
  let delay = retryMs
  let connection = deferred()
  let connected = false
  let abort: AbortController | undefined

  const disconnect = () => {
    if (connected) connection = deferred()
    connected = false
  }

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
            if (frame.event === 'resync') await handlers.onResync()
            else if (frame.event !== 'message' || frame.data)
              await handlers.onEvent(
                frame.event,
                frame.data ? (JSON.parse(frame.data) as unknown) : undefined,
              )
          }
        }
      } catch (error) {
        if (closed) break
        logger.debug(`Event stream disconnected: ${String(error)}`)
      }
      disconnect()
      if (!closed) await new Promise((done) => setTimeout(done, delay))
    }
  }

  return {
    connect(handlers) {
      if (started || closed) return
      started = true
      void run(handlers)
    },
    ready: () => connection.promise,
    close() {
      closed = true
      abort?.abort()
      disconnect()
    },
  }
}
