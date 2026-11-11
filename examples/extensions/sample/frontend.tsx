import { Type } from '@sinclair/typebox'
import type { FrontendExtension } from 'unhussle/frontend'
import { SampleTaskView } from './sample-task-view'

const extension: FrontendExtension = {
  activate: (api) => {
    api.actions.register({
      id: 'sample.titlesAction',
      description: 'Read task titles',
      input: Type.Null(),
      output: Type.Array(Type.String()),
      run: async (_input, services) =>
        (await services.queries.list('tasks')).map((task) =>
          String(task.title),
        ),
    })
    api.commands.register({
      id: 'sample.titles',
      description: 'List task titles',
      input: Type.Null(),
      output: Type.Array(Type.String()),
      steps: [
        {
          id: 'titles',
          action: 'sample.titlesAction',
          input: { from: 'input' },
        },
      ],
      result: { from: 'step', step: 'titles' },
    })
    api.views.register({
      id: 'sample.tasks',
      label: 'Sample tasks',
      component: SampleTaskView,
    })
    api.menus.register({
      id: 'sample.tasksMenu',
      label: 'Sample tasks',
      viewId: 'sample.tasks',
    })
  },
}

export default extension
