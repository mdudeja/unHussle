import { Logger } from '@c/Logger'
import type { TelemetrySink } from '@c/workflows/telemetry'

/** One line per span at debug level; successful listener spans are skipped. */
export const debugLogSink =
  (logger = Logger.getInstance()): TelemetrySink =>
  (span) => {
    if (span.kind === 'listener' && span.status === 'ok') return
    logger.debug(
      `[${span.side} ${span.kind}] ${span.name} ${span.status} ${span.durationMs.toFixed(1)}ms` +
        (span.attrs ? ` ${JSON.stringify(span.attrs)}` : '') +
        (span.error ? `: ${span.error.stack ?? span.error.message}` : ''),
      { traceId: span.traceId },
    )
  }
