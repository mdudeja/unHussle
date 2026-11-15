import { useCallback, useEffect, useState } from 'react'
import { useApi } from './api-context'
import { parseBoards, type Board } from './boards'

const BOARDS_KEY = 'boards'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; boards: Board[] }

/** Boards saved in the extension's settings. */
export function useBoards() {
  const api = useApi()
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = useCallback(() => {
    let current = true
    setState({ status: 'loading' })
    api.settings
      .get(BOARDS_KEY)
      .then((value) => {
        if (current) setState({ status: 'ready', boards: parseBoards(value) })
      })
      .catch((error: unknown) => {
        api.log.error('Could not load boards', error)
        if (current)
          setState({
            status: 'error',
            message: 'Could not load your boards. Try again.',
          })
      })
    return () => {
      current = false
    }
  }, [api])

  useEffect(load, [load])

  /** Saves the whole list; throws so the caller can show the failure. */
  const save = async (boards: Board[]) => {
    await api.settings.set(BOARDS_KEY, boards)
    setState({ status: 'ready', boards })
  }

  return { state, retry: load, save }
}
