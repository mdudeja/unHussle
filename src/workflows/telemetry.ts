import { createTelemetry } from '@c/workflows/telemetry'
import { debugLogSink } from '@c/workflows/telemetrySinks'

/** Frontend spans; the dev inspector merges them with the backend's `/telemetry`. */
export const frontendTelemetry = createTelemetry({
  side: 'frontend',
  sinks: [debugLogSink()],
})

/** Records uncaught errors and unhandled rejections as error spans. */
export function captureGlobalErrors(telemetry = frontendTelemetry) {
  const onError = (event: ErrorEvent) =>
    telemetry.error('window.error', event.error ?? event.message)
  const onRejection = (event: PromiseRejectionEvent) =>
    telemetry.error('unhandledrejection', event.reason)
  window.addEventListener('error', onError)
  window.addEventListener('unhandledrejection', onRejection)
  return () => {
    window.removeEventListener('error', onError)
    window.removeEventListener('unhandledrejection', onRejection)
  }
}
