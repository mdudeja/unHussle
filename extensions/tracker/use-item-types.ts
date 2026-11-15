import { useCallback, useEffect, useState } from 'react'
import { useTracker } from './api-context'
import { parseTypes, type ItemType } from './item-types'

const TYPES_KEY = 'types'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; types: ItemType[] }

/** Item types saved in the extension's settings; the defaults until saved. */
export function useItemTypes() {
  const { api } = useTracker()
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = useCallback(() => {
    let current = true
    setState({ status: 'loading' })
    api.settings
      .get(TYPES_KEY)
      .then((value) => {
        if (current) setState({ status: 'ready', types: parseTypes(value) })
      })
      .catch((error: unknown) => {
        api.log.error('Could not load item types', error)
        if (current)
          setState({
            status: 'error',
            message: 'Could not load your item types. Try again.',
          })
      })
    return () => {
      current = false
    }
  }, [api])

  useEffect(load, [load])

  /** Saves the whole list; throws so the caller can show the failure. */
  const save = async (types: ItemType[]) => {
    await api.settings.set(TYPES_KEY, types)
    setState({ status: 'ready', types })
  }

  return { state, retry: load, save }
}
