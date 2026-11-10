import { serializeError } from '@c/workflows/telemetry'

/** Optional structured context; the trace id and error stack are appended. */
export type LogMeta = { error?: unknown; traceId?: string }

/** Formats a log message for output, enriching it with trace context and error details when available. */
const format = (message: string, { error, traceId }: LogMeta = {}) => {
  let line = traceId ? `${message} [trace ${traceId}]` : message
  if (error !== undefined) {
    const { name, message: reason, stack } = serializeError(error)
    line += `: ${stack ?? `${name}: ${reason}`}`
  }
  return line
}

/** A singleton logger that provides configurable, level-based logging for debug, informational, warning, and error messages. */
export class Logger {
  private logMarkerMap: { [key: string]: number } = {
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    none: 5,
  }

  private logMarker: number = 0
  private static instance: Logger

  /** Initializes the logger by determining the configured log level and setting the corresponding log marker. */
  constructor() {
    // `process` is undefined in the browser (frontend bundle)
    const logLevel =
      (typeof process !== 'undefined' && process.env.VITE_LOG_LEVEL) ||
      import.meta.env.VITE_LOG_LEVEL ||
      'info'
    this.logMarker = this.logMarkerMap[logLevel] || 2

    console.log(`Log level set to: ${logLevel}`)
  }

  /** Provides access to the shared Logger instance. */
  static getInstance() {
    if (!this.instance) {
      this.instance = new Logger()
    }
    return this.instance
  }

  /** Logs a debug-level message when debug logging is enabled. */
  debug(message: string, meta?: LogMeta) {
    if (this.logMarker <= this.logMarkerMap['debug']) {
      console.debug(`DEBUG: ${format(message, meta)}`)
    }
  }

  /** Logs an informational message when the current logging level allows info-level output. */
  info(message: string, meta?: LogMeta) {
    if (this.logMarker <= this.logMarkerMap['info']) {
      console.info(`INFO: ${format(message, meta)}`)
    }
  }

  /** Logs a warning message when the logger’s configured level allows warnings. */
  warn(message: string, meta?: LogMeta) {
    if (this.logMarker <= this.logMarkerMap['warn']) {
      console.warn(`WARN: ${format(message, meta)}`)
    }
  }

  /** Logs an error-level message when error logging is enabled. */
  error(message: string, meta?: LogMeta) {
    if (this.logMarker <= this.logMarkerMap['error']) {
      console.error(`ERROR: ${format(message, meta)}`)
    }
  }
}
