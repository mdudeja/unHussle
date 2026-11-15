import { useCallback, useEffect, useState } from 'react'
import { useTracker } from './api-context'
import { parseTrackers, type Tracker } from './trackers'

const TRACKERS_KEY = 'trackers'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; trackers: Tracker[] }

/** Trackers saved in the extension's settings. */
export function useTrackers() {
  const { api } = useTracker()
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = useCallback(() => {
    let current = true
    setState({ status: 'loading' })
    api.settings
      .get(TRACKERS_KEY)
      .then((value) => {
        if (current)
          setState({ status: 'ready', trackers: parseTrackers(value) })
      })
      .catch((error: unknown) => {
        api.log.error('Could not load trackers', error)
        if (current)
          setState({
            status: 'error',
            message: 'Could not load your trackers. Try again.',
          })
      })
    return () => {
      current = false
    }
  }, [api])

  useEffect(load, [load])

  /** Saves the whole list; throws so the caller can show the failure. */
  const save = async (trackers: Tracker[]) => {
    await api.settings.set(TRACKERS_KEY, trackers)
    setState({ status: 'ready', trackers })
  }

  return { state, retry: load, save }
}
