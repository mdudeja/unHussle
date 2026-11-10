import { Type } from '@sinclair/typebox'
import { SDK_VERSION, type FrontendExtension } from '@/extensions/sdk'

import { SampleTaskView } from './SampleTaskView'
/** Opt-in example. Uses public query hooks and lifecycle-owned UI registrations. */
export const sampleFrontendExtension: FrontendExtension = {
  id: 'sample',
  sdkVersion: SDK_VERSION,
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
