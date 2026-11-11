import { useStore } from 'zustand'
import { Button } from '@/components/ui/button'
import { useWorkflowRuntime } from '@/workflows/hooks'

export function WorkflowWarnings() {
  const runtime = useWorkflowRuntime()
  const warnings = useStore(runtime.ui, (state) => state.warnings)
  if (!warnings.length) return null
  return (
    <div className="space-y-2 p-3" aria-live="polite">
      {warnings.map((warning) => (
        <div
          key={warning.id}
          role="status"
          className="flex items-center gap-3 rounded-md border border-warning/50 bg-warning/10 p-3 text-sm"
        >
          <span className="flex-1">{warning.message}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void warning.retry()}
          >
            Retry
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => runtime.dismissWarning(warning.id)}
          >
            Dismiss
          </Button>
        </div>
      ))}
    </div>
  )
}
