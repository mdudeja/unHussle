import type { FrontendExtension } from 'unhussle/frontend'
import type { KanbanExports } from '../kanban/exports'
import { TrackerContext } from './api-context'
import { TrackerView } from './tracker-view'

const KANBAN_VERSION = 1

const extension: FrontendExtension = {
  activate: (api) => {
    const kanban = api.dependencies.get<KanbanExports>('kanban')
    // Another Kanban build may provide a version this one doesn't know.
    const provided: number = kanban.version
    if (provided !== KANBAN_VERSION)
      throw new Error(
        `Progress tracker needs Kanban exports version ${KANBAN_VERSION}`,
      )
    const tracker = { api, kanban }
    api.views.register({
      id: 'tracker.items',
      label: 'Progress',
      component: () => (
        <TrackerContext.Provider value={tracker}>
          <TrackerView />
        </TrackerContext.Provider>
      ),
    })
    api.menus.register({
      id: 'tracker.menu',
      label: 'Progress',
      viewId: 'tracker.items',
    })
  },
}

export default extension
