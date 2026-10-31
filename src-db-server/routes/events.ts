import { Elysia } from 'elysia'
import { backendRuntime } from '@d/workflows/runtime'
import type { AppEvents } from '@c/workflows/contracts'

export type EventFrame = { id: number; name: string; payload: unknown }

type EventSourceRuntime = {
  events: {
    onAny(
      handler: (name: string, payload: AppEvents[keyof AppEvents]) => void,
      options?: { label?: string },
    ): () => void
  }
}

/**
 * Numbers every published event and fans it out to connected clients. A
 * bounded buffer lets reconnecting clients replay what they missed; when the
 * gap is no longer covered they are told to resync instead.
 */
export function createEventForwarder(
  runtime: EventSourceRuntime,
  { bufferSize = 500 }: { bufferSize?: number } = {},
) {
  let lastId = 0
  const buffer: EventFrame[] = []
  const clients = new Set<(frame: EventFrame) => void>()

  const stop = runtime.events.onAny(
    (name, payload) => {
      const frame = { id: ++lastId, name, payload }
      buffer.push(frame)
      if (buffer.length > bufferSize) buffer.shift()
      for (const send of clients) send(frame)
    },
    { label: 'sse-forwarder' },
  )

  return {
    lastId: () => lastId,
    /** Registers a client; `replay` is what it missed since `lastEventId`. */
    subscribe(send: (frame: EventFrame) => void, lastEventId?: number) {
      clients.add(send)
      let replay: EventFrame[] | 'resync' = []
      if (lastEventId !== undefined && lastEventId !== lastId) {
        const covered =
          lastEventId < lastId &&
          (buffer[0]?.id ?? lastId + 1) <= lastEventId + 1
        replay = covered
          ? buffer.filter((frame) => frame.id > lastEventId)
          : 'resync'
      }
      return {
        replay,
        unsubscribe: () => {
          clients.delete(send)
        },
      }
    },
    dispose() {
      stop()
      clients.clear()
      buffer.length = 0
    },
  }
}

export type EventForwarder = ReturnType<typeof createEventForwarder>

export const formatFrame = ({ id, name, payload }: EventFrame) =>
  `id: ${id}\nevent: ${name}\ndata: ${JSON.stringify(payload ?? null)}\n\n`

export const createEventRoutes = (forwarder: EventForwarder) =>
  new Elysia({ name: 'events' }).get(
    '/events',
    ({ headers, request, server }) => {
      // A quiet stream counts as idle, and the server closes idle connections
      // (Elysia's default is 30s). Disable the timeout for this request only;
      // `serve` options on a plugin are ignored, only the listening app's apply.
      server?.timeout(request, 0)

      const encoder = new TextEncoder()
      const parsed = Number(headers['last-event-id'])
      const lastEventId = Number.isInteger(parsed) ? parsed : undefined
      let cleanup = () => {}

      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const write = (text: string) => {
            try {
              controller.enqueue(encoder.encode(text))
            } catch {
              cleanup()
            }
          }
          const { replay, unsubscribe } = forwarder.subscribe(
            (frame) => write(formatFrame(frame)),
            lastEventId,
          )
          cleanup = unsubscribe
          write('retry: 2000\n\n')
          if (replay === 'resync')
            write(
              formatFrame({
                id: forwarder.lastId(),
                name: 'resync',
                payload: {},
              }),
            )
          else for (const frame of replay) write(formatFrame(frame))

          // No heartbeat: the client is local, so a closed webview or sidecar
          // closes the socket and fires `abort` / ends the client's read.
          request.signal.addEventListener('abort', () => {
            cleanup()
            try {
              controller.close()
            } catch {
              // already closed
            }
          })
        },
        cancel() {
          cleanup()
        },
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    },
  )

export const eventForwarder = createEventForwarder(backendRuntime)
export const eventRoutes = createEventRoutes(eventForwarder)
