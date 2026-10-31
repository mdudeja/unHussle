import { appendFile, rename, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { debugLogSink } from '@c/workflows/telemetrySinks'
import {
  createTelemetry,
  type Span,
  type TelemetrySink,
} from '@c/workflows/telemetry'

/**
 * Appends spans as JSON lines, batched so writes never run inside a
 * transaction. Rotates to `<file>.1` past `maxBytes`, keeping one old file.
 */
export function jsonlSink(
  file: string,
  { maxBytes = 5 * 1024 * 1024, flushMs = 500 } = {},
): TelemetrySink {
  let lines: string[] = []
  let timer: ReturnType<typeof setTimeout> | undefined
  let writing = Promise.resolve()

  const flush = async () => {
    timer = undefined
    const batch = lines.join('')
    lines = []
    try {
      const size = await stat(file).then(
        (info) => info.size,
        () => 0,
      )
      if (size + batch.length > maxBytes) await rename(file, `${file}.1`)
      await appendFile(file, batch)
    } catch {
      // Telemetry is best effort; the sidecar keeps running without it.
    }
  }

  return (span: Span) => {
    lines.push(`${JSON.stringify(span)}\n`)
    timer ??= setTimeout(() => {
      writing = writing.then(flush)
    }, flushMs)
  }
}

const telemetryFile = () => {
  const dbFile = process.env.DB_FILE_URL
  if (!dbFile || dbFile === ':memory:' || process.env.NODE_ENV === 'test')
    return undefined
  return join(dirname(dbFile), 'telemetry.jsonl')
}

const file = telemetryFile()

export const backendTelemetry = createTelemetry({
  side: 'backend',
  sinks: [debugLogSink(), ...(file ? [jsonlSink(file)] : [])],
})
