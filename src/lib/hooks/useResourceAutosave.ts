import { useEffect, useRef, useState } from 'react'
import { useBlocker } from 'react-router'
import {
  createResourceAutosave,
  type AutosaveState,
  type ResourceAutosave,
} from '@/lib/resourceAutosave'
import { HttpError } from '@/lib/server'
import { useWorkflowRuntime } from '@/workflows/hooks'

/**
 * Autosave for one open resource. Saves are flushed when leaving the page;
 * if a save fails there, the user is asked before their edits are dropped.
 */
export function useResourceAutosave(id: string, baseHash: string | null) {
  const runtime = useWorkflowRuntime()
  const [state, setState] = useState<AutosaveState>({
    status: 'idle',
    baseHash,
  })
  const autosaveRef = useRef<ResourceAutosave | null>(null)

  useEffect(() => {
    const autosave = createResourceAutosave({
      baseHash,
      save: (content, base, force) =>
        runtime.commands.execute('resource.content.save', {
          id,
          content,
          baseHash: base,
          force,
        }),
      isConflict: (error) => error instanceof HttpError && error.status === 409,
      onChange: setState,
    })
    autosaveRef.current = autosave
    /** Ensures any pending autosave changes are flushed and persisted before the page is unloaded. */
    const flushBeforeUnload = () => void autosave.flush()
    window.addEventListener('beforeunload', flushBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', flushBeforeUnload)
      void autosave.flush()
      autosave.dispose()
    }
    // The base hash only seeds a new autosave; later hashes come from saves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, id])

  const blocker = useBlocker(() => autosaveRef.current?.hasUnsaved ?? false)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const autosave = autosaveRef.current
    void (async () => {
      await autosave?.flush()
      const status = autosave?.state.status
      if (status === 'error' || status === 'conflict' || autosave?.hasUnsaved) {
        if (window.confirm('Your latest edits are not saved. Leave anyway?'))
          blocker.proceed()
        else blocker.reset()
        return
      }
      blocker.proceed()
    })()
  }, [blocker])

  return { state, autosave: autosaveRef }
}
