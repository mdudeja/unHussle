import { serializeError } from '@c/workflows/telemetry'

/** Optional structured context; the trace id and error stack are appended. */
export type LogMeta = { error?: unknown; traceId?: string }

const format = (message: string, { error, traceId }: LogMeta = {}) => {
  let line = traceId ? `${message} [trace ${traceId}]` : message
  if (error !== undefined) {
    const { name, message: reason, stack } = serializeError(error)
    line += `: ${stack ?? `${name}: ${reason}`}`
  }
  return line
}

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

  constructor() {
    // `process` is undefined in the browser (frontend bundle)
    const logLevel =
      (typeof process !== 'undefined' && process.env.VITE_LOG_LEVEL) ||
      import.meta.env.VITE_LOG_LEVEL ||
      'info'
    this.logMarker = this.logMarkerMap[logLevel] || 2

    console.log(`Log level set to: ${logLevel}`)
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new Logger()
    }
    return this.instance
  }

  debug(message: string, meta?: LogMeta) {
    if (this.logMarker <= this.logMarkerMap['debug']) {
      console.debug(`DEBUG: ${format(message, meta)}`)
    }
  }

  info(message: string, meta?: LogMeta) {
    if (this.logMarker <= this.logMarkerMap['info']) {
      console.info(`INFO: ${format(message, meta)}`)
    }
  }

  warn(message: string, meta?: LogMeta) {
    if (this.logMarker <= this.logMarkerMap['warn']) {
      console.warn(`WARN: ${format(message, meta)}`)
    }
  }

  error(message: string, meta?: LogMeta) {
    if (this.logMarker <= this.logMarkerMap['error']) {
      console.error(`ERROR: ${format(message, meta)}`)
    }
  }
}
