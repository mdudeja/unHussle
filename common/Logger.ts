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

  debug(message: string) {
    if (this.logMarker <= this.logMarkerMap['debug']) {
      console.debug(`DEBUG: ${message}`)
    }
  }

  info(message: string) {
    if (this.logMarker <= this.logMarkerMap['info']) {
      console.info(`INFO: ${message}`)
    }
  }

  warn(message: string) {
    if (this.logMarker <= this.logMarkerMap['warn']) {
      console.warn(`WARN: ${message}`)
    }
  }

  error(message: string) {
    if (this.logMarker <= this.logMarkerMap['error']) {
      console.error(`ERROR: ${message}`)
    }
  }
}
