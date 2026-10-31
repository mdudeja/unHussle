import { getNowMillis } from '@c/datetimeUtils'

export const spanKinds = [
  'command',
  'action',
  'event',
  'listener',
  'reaction',
  'http',
  'query',
  'signal',
  'wait',
  'error',
] as const
export type SpanKind = (typeof spanKinds)[number]

export type SpanAttrs = Record<string, string | number | boolean>

export type SerializedError = { name: string; message: string; stack?: string }

/** Shaped after OpenTelemetry spans, so an OTLP exporter can be added later. */
export type Span = {
  /** The operationId, when one is known. */
  traceId: string
  spanId: string
  parentId?: string
  kind: SpanKind
  /** e.g. `entity.change`, `upsertRows`, `tasks.delete`. */
  name: string
  side: 'frontend' | 'backend'
  /** Epoch milliseconds. */
  start: number
  durationMs: number
  status: 'ok' | 'error'
  error?: SerializedError
  /** Identifiers and counts only; never payloads (they hold user data). */
  attrs?: SpanAttrs
}

/** Where a span sits in its trace; passed to handlers so they can nest work. */
export type TraceContext = { traceId: string; spanId: string }

export type SpanOptions = {
  traceId?: string
  parentId?: string
  attrs?: SpanAttrs
}

/** What a handler sees of the span it runs in: enough to nest and annotate. */
export type SpanScope = TraceContext & { setAttrs(attrs: SpanAttrs): void }

/** A span that is still running. `end` records it; later calls are ignored. */
export type ActiveSpan = SpanScope & {
  fail(error: unknown): void
  end(): void
}

export type SpanFilter = {
  traceId?: string
  kind?: SpanKind
  /** Only spans that started at or after this epoch millisecond. */
  since?: number
  status?: Span['status']
  limit?: number
}

export type TelemetrySink = (span: Span) => void

/** Headers that join a backend request to the frontend trace that sent it. */
export const traceIdHeader = 'x-trace-id'
export const parentSpanHeader = 'x-parent-span-id'

export const newId = () => crypto.randomUUID()

/** Keeps the name, message and stack, which `String(error)` drops. */
export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error)
    return { name: error.name, message: error.message, stack: error.stack }
  if (typeof error === 'string') return { name: 'Error', message: error }
  try {
    return { name: 'Error', message: JSON.stringify(error) }
  } catch {
    return { name: 'Error', message: String(error) }
  }
}

const isPromise = (value: unknown): value is Promise<unknown> =>
  value instanceof Promise

/**
 * Records spans into a bounded ring buffer and fans them out to sinks. Sinks
 * and subscribers can never fail the work being measured.
 */
export function createTelemetry({
  side,
  sinks = [],
  bufferSize = 2000,
}: {
  side: Span['side']
  sinks?: TelemetrySink[]
  bufferSize?: number
}) {
  const buffer: Span[] = []
  const listeners = new Set<TelemetrySink>([...sinks])

  const record = (span: Span) => {
    buffer.push(span)
    if (buffer.length > bufferSize) buffer.shift()
    for (const listener of listeners)
      try {
        listener(span)
      } catch {
        // A broken sink must not break the workflow.
      }
  }

  const start = (
    kind: SpanKind,
    name: string,
    { traceId = newId(), parentId, attrs }: SpanOptions = {},
  ): ActiveSpan => {
    const spanId = newId()
    const startedAt = getNowMillis()
    const clock = performance.now()
    let current = attrs ? { ...attrs } : undefined
    let error: SerializedError | undefined
    let ended = false
    return {
      traceId,
      spanId,
      setAttrs(next) {
        current = { ...current, ...next }
      },
      fail(reason) {
        error = serializeError(reason)
      },
      end() {
        if (ended) return
        ended = true
        record({
          traceId,
          spanId,
          ...(parentId ? { parentId } : {}),
          kind,
          name,
          side,
          start: startedAt,
          durationMs: performance.now() - clock,
          status: error ? 'error' : 'ok',
          ...(error ? { error } : {}),
          ...(current ? { attrs: current } : {}),
        })
      },
    }
  }

  /** Runs `fn` inside a span. Synchronous work stays synchronous. */
  function span<T>(
    kind: SpanKind,
    name: string,
    fn: (span: ActiveSpan) => T,
    options?: SpanOptions,
  ): T {
    const active = start(kind, name, options)
    let result: T
    try {
      result = fn(active)
    } catch (error) {
      active.fail(error)
      active.end()
      throw error
    }
    if (!isPromise(result)) {
      active.end()
      return result
    }
    return result.then(
      (value) => {
        active.end()
        return value
      },
      (error: unknown) => {
        active.fail(error)
        active.end()
        throw error
      },
    ) as T
  }

  return {
    side,
    start,
    span,
    record,
    /** A zero-duration marker, e.g. `events.timeout` or `stream.resync`. */
    signal(
      name: string,
      attrs?: SpanAttrs,
      { error, ...options }: SpanOptions & { error?: unknown } = {},
    ) {
      const active = start('signal', name, { ...options, attrs })
      if (error !== undefined) active.fail(error)
      active.end()
    },
    /** Records an error that has no span of its own (e.g. an uncaught error). */
    error(name: string, error: unknown, options?: SpanOptions) {
      const active = start('error', name, options)
      active.fail(error)
      active.end()
    },
    recent({ traceId, kind, since, status, limit }: SpanFilter = {}) {
      const spans = buffer.filter(
        (span) =>
          (!traceId || span.traceId === traceId) &&
          (!kind || span.kind === kind) &&
          (since === undefined || span.start >= since) &&
          (!status || span.status === status),
      )
      return limit ? spans.slice(-limit) : spans
    },
    subscribe(listener: TelemetrySink) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    clear() {
      buffer.length = 0
    },
  }
}

export type Telemetry = ReturnType<typeof createTelemetry>
