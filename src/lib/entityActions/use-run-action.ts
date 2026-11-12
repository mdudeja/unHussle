import { useState } from 'react'
import { Logger } from '@c/Logger'
import type { EntityAction } from './types'

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

export type ActionRunner<T> = ReturnType<typeof useRunAction<T>>

/**
 * Runs actions on `item`, asking first when an action needs confirmation.
 * Failures are logged and kept in `error` (or `confirmError` while the
 * confirmation is open) for the renderer to show.
 */
export function useRunAction<T>(item: T) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<EntityAction<T> | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  // Returns whether the action succeeded.
  const run = async (
    action: EntityAction<T>,
    onError: (message: string) => void,
  ) => {
    setPendingId(action.id)
    setError(null)
    try {
      await action.run(item)
      return true
    } catch (err) {
      Logger.getInstance().error(`Action "${action.label}" failed`, {
        error: err,
      })
      onError(`Could not ${action.label.toLowerCase()}: ${errorMessage(err)}`)
      return false
    } finally {
      setPendingId(null)
    }
  }

  const trigger = (action: EntityAction<T>) => {
    if (action.confirm) {
      setConfirmError(null)
      setConfirming(action)
      return
    }
    // `run` reports its own errors
    void run(action, setError)
  }

  const confirm = async () => {
    if (confirming && (await run(confirming, setConfirmError))) {
      setConfirming(null)
    }
  }

  const cancelConfirm = () => {
    if (pendingId === null) {
      setConfirming(null)
    }
  }

  return {
    item,
    pendingId,
    error,
    confirming,
    confirmError,
    trigger,
    confirm,
    cancelConfirm,
  }
}
