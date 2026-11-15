import { createContext, useContext } from 'react'
import type { FrontendExtension } from 'unhussle/frontend'
import type { KanbanExports } from '../kanban/exports'

export type Api = Parameters<FrontendExtension['activate']>[0]
type Tracker = { api: Api; kanban: KanbanExports }

export const TrackerContext = createContext<Tracker | null>(null)

/** The extension API and Kanban's exports, for the tracker's views. */
export function useTracker() {
  const tracker = useContext(TrackerContext)
  if (!tracker) throw new Error('Tracker components need the extension API')
  return tracker
}
