import type { FrontendExtension } from 'unhussle/frontend'
import { ApiContext } from './api-context'
import { KanbanView } from './kanban-view'
import { kanbanExports } from './exports'

const extension: FrontendExtension = {
  activate: (api) => {
    api.exports.provide(kanbanExports)
    api.views.register({
      id: 'kanban.boards',
      label: 'Kanban',
      component: () => (
        <ApiContext.Provider value={api}>
          <KanbanView />
        </ApiContext.Provider>
      ),
    })
    api.menus.register({
      id: 'kanban.menu',
      label: 'Kanban',
      viewId: 'kanban.boards',
    })
  },
}

export default extension
