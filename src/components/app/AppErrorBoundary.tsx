import { useEffect } from 'react'
import { useRouteError } from 'react-router'
import { Logger } from '@c/Logger'
import { Button } from '@/components/ui/button'
import { frontendTelemetry } from '@/workflows/telemetry'

// StrictMode runs effects twice; record each error once.
const recorded = new WeakSet<object>()

/** Root route error boundary: records the render error, offers a reload. */
export function AppErrorBoundary() {
  const error = useRouteError()

  useEffect(() => {
    if (typeof error === 'object' && error !== null) {
      if (recorded.has(error)) return
      recorded.add(error)
    }
    frontendTelemetry.error('render', error)
    Logger.getInstance().error('Unhandled render error', { error })
  }, [error])

  return (
    <div
      role="alert"
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <p className="text-lg font-medium">Something went wrong.</p>
      <p className="text-sm text-muted-foreground">
        {error instanceof Error
          ? error.message
          : 'An unexpected error occurred.'}
      </p>
      <Button onClick={() => window.location.reload()}>Reload</Button>
    </div>
  )
}
