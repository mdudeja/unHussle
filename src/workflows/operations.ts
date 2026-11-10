type Pending = { remaining: Set<string>; resolve: () => void }

/**
 * Lets a command wait until the events it caused (matched by operationId and
 * event name) have been received and fully handled by their reactions.
 */
export function createOperationTracker() {
  const pending = new Map<string, Pending>()

  return {
    /** Starts tracking a pending operation until all specified events have occurred. */
    begin(operationId: string, eventNames: string[]) {
      /** Resolves the pending operation. */
      let resolve = () => {}
      const settled = new Promise<void>((done) => {
        resolve = done
      })
      pending.set(operationId, { remaining: new Set(eventNames), resolve })
      return {
        settled,
        cancel: () => {
          pending.delete(operationId)
          resolve()
        },
      }
    },
    has: (operationId: string) => pending.has(operationId),
    /** Marks one event of an operation as handled. */
    handled(operationId: string | undefined, eventName: string) {
      if (!operationId) return
      const operation = pending.get(operationId)
      if (!operation) return
      operation.remaining.delete(eventName)
      if (operation.remaining.size > 0) return
      pending.delete(operationId)
      operation.resolve()
    },
    /** Resolves all pending operations and clears the pending collection, completing outstanding work before disposal. */
    dispose() {
      for (const operation of pending.values()) operation.resolve()
      pending.clear()
    },
  }
}

export type OperationTracker = ReturnType<typeof createOperationTracker>

/** Resolves `true` if `promise` settles within `ms`, otherwise `false`. */
export const settlesWithin = (promise: Promise<unknown>, ms: number) =>
  new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), ms)
    promise.then(
      () => {
        clearTimeout(timer)
        resolve(true)
      },
      () => {
        clearTimeout(timer)
        resolve(false)
      },
    )
  })
