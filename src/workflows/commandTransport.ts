import type { TraceMeta } from '@c/workflows/runtime'
import type { SpanScope, Telemetry } from '@c/workflows/telemetry'
import type { MutationOptions } from '@/services/database/DbService'
import type { EventTransport } from './eventStream'
import { createOperationTracker, settlesWithin } from './operations'

/** Transport mechanics shared by every write; queues and domain behavior stay outside. */
export function createCommandTransport({
  transport,
  telemetry,
  eventTimeoutMs,
  readyTimeoutMs,
}: {
  transport: EventTransport
  telemetry: Telemetry
  eventTimeoutMs: number
  readyTimeoutMs: number
}) {
  const operations = createOperationTracker()
  const traces = new Map<string, TraceMeta>()
  let disposed = false
  return {
    traceOf: (operationId?: string): TraceMeta =>
      (operationId && traces.get(operationId)) || { traceId: operationId },
    pending: (operationId: string) => operations.has(operationId),
    handled: (operationId: string | undefined, name: string) =>
      operations.handled(operationId, name),
    /** Sends a command request and waits for its expected events to settle, recovering the operation if event settlement times out. */
    async send<T>(
      {
        command,
        expectedEvents,
        request,
        recover,
        attrs = {},
      }: {
        command: string
        expectedEvents: string[]
        request: (options: MutationOptions) => Promise<T>
        recover: (operationId: string) => Promise<void>
        attrs?: Record<string, string>
      },
      trace?: SpanScope,
    ) {
      if (disposed) throw new Error('Command transport is disposed')
      const operationId = crypto.randomUUID()
      const traceId = trace?.traceId ?? operationId
      const child = { traceId, parentId: trace?.spanId }
      trace?.setAttrs({ ...attrs, operationId })
      traces.set(operationId, child)
      // Subscribe before readiness or HTTP: events may precede the HTTP response.
      const operation = operations.begin(operationId, expectedEvents)
      try {
        await telemetry.span(
          'wait',
          'stream.ready',
          async (span) => {
            span.setAttrs({
              ready: await settlesWithin(transport.ready(), readyTimeoutMs),
            })
          },
          child,
        )
        if (disposed) throw new Error('Command transport is disposed')
        const result = await telemetry.span(
          'http',
          command,
          (span) =>
            request({
              operationId,
              traceId,
              parentSpanId: span.spanId,
            }),
          { ...child, attrs },
        )
        const settled = await telemetry.span(
          'wait',
          'events.settle',
          async (span) => {
            const settled = await settlesWithin(
              operation.settled,
              eventTimeoutMs,
            )
            span.setAttrs({ settled })
            return settled
          },
          child,
        )
        if (!settled && !disposed) {
          telemetry.signal(
            'events.timeout',
            { command, ...attrs, timeoutMs: eventTimeoutMs },
            child,
          )
          await recover(operationId)
        }
        return { result, operationId }
      } finally {
        operation.cancel()
        traces.delete(operationId)
      }
    },
    /** Disposes of the instance, releasing its resources and clearing its state. */
    dispose() {
      disposed = true
      operations.dispose()
      traces.clear()
    },
  }
}
