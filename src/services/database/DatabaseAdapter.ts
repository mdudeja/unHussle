import { makeTextRequest } from '@/lib/server'

export class DatabaseAdapter {
  private isReady: boolean = false
  private port: number | null = null
  private url: string | null = null

  private maxRetries: number = 10
  private retryDelay: number = 1000 // 1 second

  constructor(maxRetries?: number, retryDelay?: number) {
    this.port = import.meta.env.VITE_DB_SERVER_PORT
      ? parseInt(import.meta.env.VITE_DB_SERVER_PORT, 10)
      : null

    if (!this.port) {
      throw new Error('VITE_DB_SERVER_PORT is not defined')
    }

    this.url = `http://localhost:${this.port}`

    if (maxRetries !== undefined) {
      this.maxRetries = maxRetries
    }

    if (retryDelay !== undefined) {
      this.retryDelay = retryDelay
    }
  }

  public async initialize() {
    if (!this.url) {
      throw new Error('Database server URL is not defined')
    }

    const healthUrl = `${this.url}/health`

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const serverOk = await makeTextRequest({
          url: healthUrl,
          method: 'GET',
        })
        if (serverOk === 'OK') {
          this.isReady = true
          console.log('Connected to database server.')
          return
        }
      } catch (err) {
        console.warn(`Attempt ${attempt} to connect to database server failed.`)
      }
      await new Promise((resolve) => setTimeout(resolve, this.retryDelay))
    }

    throw new Error(
      'Failed to connect to database server after multiple attempts',
    )
  }

  public getReadyStatus() {
    return this.isReady
  }
}
