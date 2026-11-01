import { Elysia, t } from 'elysia'
import type { TraceMeta } from '@c/workflows/runtime'
import {
  newId,
  parentSpanHeader,
  serializeError,
  spanKinds,
  traceIdHeader,
  type SerializedError,
} from '@c/workflows/telemetry'
import { getNowMillis } from '@c/datetimeUtils'
import { backendTelemetry } from '@d/workflows/telemetry'

/** Lets clients correlate a mutation with the events it publishes. */
export const operationIdHeader = 'x-operation-id'

type RequestSpan = {
  traceId: string
  spanId: string
  parentId?: string
  start: number
  clock: number
  error?: SerializedError
}

const requestSpans = new WeakMap<Request, RequestSpan>()

/** The long-lived stream, the inspector's own reads and the docs are not traced. */
const untraced = (path: string) =>
  path === '/events' || path === '/telemetry' || path.startsWith('/api')

/** Lets route handlers run their command inside the request's span. */
export const traceOf = (request: Request): TraceMeta => {
  const span = requestSpans.get(request)
  return span ? { traceId: span.traceId, parentId: span.spanId } : {}
}

/** One `http` span per request; its trace id comes from the frontend. */
export const httpTracing = new Elysia({ name: 'http-tracing' })
  .onRequest(({ request }) => {
    if (untraced(new URL(request.url).pathname)) return
    const { headers } = request
    requestSpans.set(request, {
      traceId:
        headers.get(traceIdHeader) ?? headers.get(operationIdHeader) ?? newId(),
      spanId: newId(),
      parentId: headers.get(parentSpanHeader) ?? undefined,
      start: getNowMillis(),
      clock: performance.now(),
    })
  })
  .onError({ as: 'global' }, ({ request, error }) => {
    const span = requestSpans.get(request)
    if (span) span.error = serializeError(error)
  })
  .onAfterResponse({ as: 'global' }, ({ request, route, set }) => {
    const span = requestSpans.get(request)
    if (!span) return
    requestSpans.delete(request)
    const status = typeof set.status === 'number' ? set.status : 200
    const error =
      span.error ??
      (status >= 500
        ? { name: 'HttpError', message: `Status ${status}` }
        : undefined)
    backendTelemetry.record({
      traceId: span.traceId,
      spanId: span.spanId,
      ...(span.parentId ? { parentId: span.parentId } : {}),
      kind: 'http',
      name: `${request.method} ${route}`,
      side: 'backend',
      start: span.start,
      durationMs: performance.now() - span.clock,
      status: error ? 'error' : 'ok',
      ...(error ? { error } : {}),
      attrs: { method: request.method, route, status },
    })
  })

/** The backend half of a trace, for the dev inspector. Never on `AppEvents`. */
export const telemetryRoutes = new Elysia({ name: 'telemetry' }).get(
  '/telemetry',
  ({ query }) => backendTelemetry.recent(query),
  {
    query: t.Object({
      traceId: t.Optional(t.String()),
      // Not `t.UnionEnum`: when optional, it defaults to its first value.
      kind: t.Optional(t.Union(spanKinds.map((kind) => t.Literal(kind)))),
      status: t.Optional(t.Union([t.Literal('ok'), t.Literal('error')])),
      since: t.Optional(t.Numeric()),
      limit: t.Optional(t.Numeric()),
    }),
  },
)
