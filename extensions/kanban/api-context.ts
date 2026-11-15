import { createContext, useContext } from 'react'
import type { FrontendExtension } from 'unhussle/frontend'

export type Api = Parameters<FrontendExtension['activate']>[0]

export const ApiContext = createContext<Api | null>(null)

export function useApi() {
  const api = useContext(ApiContext)
  if (!api) throw new Error('Kanban components need the extension API')
  return api
}
