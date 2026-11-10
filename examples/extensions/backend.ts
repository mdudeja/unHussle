import { Type } from '@sinclair/typebox'
import { SDK_VERSION, type BackendExtension } from '@d/extensions/sdk'

/** Opt-in in-process example. Imports only the public backend SDK. */
export const sampleBackendExtension: BackendExtension = {
  id: 'sample',
  sdkVersion: SDK_VERSION,
  /** Registers sample actions, commands, and workflows for atomically capturing a task and describing its title. */
  activate: (api) => {
    const result = Type.Object({ id: Type.String() })
    api.atomic.action({
      id: 'sample.captureAction',
      description: 'Capture one planned task',
      input: Type.String({ minLength: 1 }),
      output: result,
      /** Creates a new task with the given title. */
      run: (title, domain) => {
        const row = domain.mutations.apply({
          kind: 'tasks',
          action: 'create',
          changes: { title },
        })
        if (!row || Array.isArray(row)) throw new Error('Task was not created')
        return { id: row.id }
      },
    })
    api.atomic.command({
      id: 'sample.capture',
      description: 'Capture a task atomically',
      input: Type.String({ minLength: 1 }),
      output: result,
      steps: [
        {
          id: 'capture',
          action: 'sample.captureAction',
          input: { from: 'input' },
        },
      ],
      result: { from: 'step', step: 'capture' },
    })
    api.actions.register({
      id: 'sample.describeAction',
      description: 'Read a captured task title',
      input: Type.String(),
      output: Type.String(),
      /** Retrieves the title of a task. */
      run: async (id, services) => {
        const task = await services.queries.get('tasks', id)
        if (!task) throw new Error('Task not found')
        return String(task.title)
      },
    })
    api.commands.register({
      id: 'sample.describe',
      description: 'Describe a task',
      input: Type.String(),
      output: Type.String(),
      steps: [
        {
          id: 'describe',
          action: 'sample.describeAction',
          input: { from: 'input' },
        },
      ],
      result: { from: 'step', step: 'describe' },
    })
    api.workflows.register({
      id: 'sample.captureAndDescribe',
      description: 'Commit capture, then read its title',
      input: Type.String({ minLength: 1 }),
      output: Type.String(),
      steps: [
        { id: 'capture', command: 'sample.capture', input: { from: 'input' } },
        {
          id: 'describe',
          command: 'sample.describe',
          input: { from: 'step', step: 'capture', path: ['id'] },
        },
      ],
      result: { from: 'step', step: 'describe' },
    })
    api.events.on('tasks.add', async () => {
      await api.settings.set('lastCapture', Date.now())
    })
  },
}
