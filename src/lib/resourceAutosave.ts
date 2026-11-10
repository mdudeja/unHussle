export type AutosaveStatus =
  'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict'

export type AutosaveState = {
  status: AutosaveStatus
  /** Hash of the file as last read or written; sent as the save's base. */
  baseHash: string | null
  error?: string
}

export type AutosaveOptions = {
  save: (
    content: string,
    baseHash: string | null,
    force: boolean,
  ) => Promise<{ content_hash: string }>
  isConflict: (error: unknown) => boolean
  onChange: (state: AutosaveState) => void
  baseHash: string | null
  delayMs?: number
  setTimer?: (run: () => void, ms: number) => unknown
  clearTimer?: (timer: unknown) => void
}

/**
 * Debounced saving of one resource. Only one save is in flight; edits made
 * meanwhile are kept and saved after it, newest content only. A conflict
 * (the file changed outside the app) stops saving until the user reloads
 * or overwrites.
 */
export function createResourceAutosave({
  save,
  isConflict,
  onChange,
  baseHash: initialHash,
  delayMs = 1000,
  setTimer = (run, ms) => setTimeout(run, ms),
  clearTimer = (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
}: AutosaveOptions) {
  let state: AutosaveState = { status: 'idle', baseHash: initialHash }
  let pending: string | undefined
  let timer: unknown
  let inFlight: Promise<void> | undefined
  let disposed = false

  /** Updates the autosave state with the given changes and notifies listeners when autosave is active. */
  const set = (next: Partial<AutosaveState>) => {
    state = { ...state, ...next }
    if (!disposed) onChange(state)
  }

  /** Cancels the currently active timer, if one exists. */
  const cancelTimer = () => {
    if (timer !== undefined) clearTimer(timer)
    timer = undefined
  }

  /** Schedules a flush to occur after the configured delay, replacing any previously scheduled flush. */
  const schedule = () => {
    cancelTimer()
    timer = setTimer(() => {
      timer = undefined
      void flush()
    }, delayMs)
  }

  /** Persists pending content, ensuring concurrent save requests are handled in order and unsaved content is preserved if saving fails. */
  const send = async (force: boolean): Promise<void> => {
    if (inFlight) {
      await inFlight
      return send(force)
    }
    if (pending === undefined) return
    const content = pending
    pending = undefined
    set({ status: 'saving', error: undefined })
    inFlight = save(content, state.baseHash, force)
      .then(({ content_hash }) => {
        set({
          baseHash: content_hash,
          status: pending === undefined ? 'saved' : 'dirty',
        })
        if (pending !== undefined) schedule()
      })
      .catch((error: unknown) => {
        // Keep the unsaved text so a retry or overwrite can still send it.
        pending ??= content
        set(
          isConflict(error)
            ? { status: 'conflict', error: undefined }
            : {
                status: 'error',
                error: error instanceof Error ? error.message : String(error),
              },
        )
      })
      .finally(() => {
        inFlight = undefined
      })
    return inFlight
  }

  /** Flushes pending changes immediately, waiting for any conflict resolution to complete first. */
  const flush = () => {
    cancelTimer()
    if (state.status === 'conflict') return inFlight ?? Promise.resolve()
    return send(false)
  }

  return {
    /** Provides access to the current state. */
    get state() {
      return state
    },
    /** Indicates whether there are unsaved changes that are pending or currently in progress. */
    get hasUnsaved() {
      return pending !== undefined || inFlight !== undefined
    },
    /** Records an edit; it is saved after `delayMs` without further edits. */
    edit(content: string) {
      pending = content
      if (state.status === 'conflict') return
      set({ status: 'dirty' })
      schedule()
    },
    /** Saves now (on blur, unmount or navigation). */
    flush,
    /** Retries after an error. */
    retry: () => send(false),
    /** Saves over the file even though it changed outside the app. */
    overwrite: () => {
      cancelTimer()
      return send(true)
    },
    /** Drops unsaved edits after the file was reloaded from disk. */
    reset(baseHash: string | null) {
      cancelTimer()
      pending = undefined
      set({ status: 'idle', baseHash, error: undefined })
    },
    /** Releases the objects resources and marks it as disposed so it is no longer used. */
    dispose() {
      cancelTimer()
      disposed = true
    },
  }
}

export type ResourceAutosave = ReturnType<typeof createResourceAutosave>
