import { createStore, type StoreApi } from 'zustand/vanilla'
import { createRuntime } from '@c/workflows/runtime'
import type {
  EntryKind,
  EntryRecord,
  MutationEvent,
  MutationInput,
} from '@c/workflows/contracts'
import { ProgressStatus } from '@c/types'
import { getNowMillis } from '@c/datetimeUtils'
import { Logger } from '@c/Logger'
import type { StoreState } from '@/store'
import { createQueryCoordinator } from './queries'
import { entityServices, fetchLimits } from './services'
import {
  createTracking,
  type SessionStorage,
  type WorkflowUIState,
} from './tracking'
import type {
  EntryTransport,
  FrontendCommands,
  FrontendEvents,
  Transition,
} from './contracts'
import { createSseTransport, type EventTransport } from './eventStream'
import { createOperationTracker, settlesWithin } from './operations'
import { createReactions } from './reactions'
import { reactionRegistry } from './reactionRegistry'
import {
  mutationHeads,
  mutationVerbs,
  type MutationVerb,
} from './commandRegistry'

export type { EntryTransport } from './contracts'

type MutationCommand = `${(typeof mutationHeads)[number]}.${MutationVerb}`

const allKinds: EntryKind[] = [
  'tasks',
  'resources',
  'projects',
  'areas',
  'goals',
  'tags',
  'urls',
  'time_entries',
]

const queryKindToLabel: Record<string, string> = {
  search: 'search results',
  related: 'related tasks',
  tagged: 'tagged items',
  detail: 'item details',
  urls: 'links',
  time_entries: 'time entries',
}

export function createFrontendRuntime(
  store: StoreApi<StoreState>,
  options: {
    services?: Record<EntryKind, EntryTransport>
    storage?: SessionStorage
    now?: () => number
    transport?: EventTransport
    /** How long a command waits for its events before reloading instead. */
    eventTimeoutMs?: number
    /** How long a command waits for the event stream to connect. */
    readyTimeoutMs?: number
  } = {},
) {
  let disposed = false
  const logger = Logger.getInstance()
  const queries = createQueryCoordinator()
  const operations = createOperationTracker()
  const transport = options.transport ?? createSseTransport()
  const eventTimeoutMs = options.eventTimeoutMs ?? 3000
  const readyTimeoutMs = options.readyTimeoutMs ?? 1000
  const ui = createStore<WorkflowUIState>(() => ({
    tracking: null,
    warnings: [],
  }))
  const tracking = createTracking(
    ui,
    options.storage ??
      (typeof localStorage === 'undefined' ? undefined : localStorage),
  )

  const services: Record<EntryKind, EntryTransport> =
    options.services ?? entityServices

  const projectRecord = (kind: EntryKind, data: EntryRecord[]) => {
    if (disposed) return
    store.setState((state) => ({ [kind]: { ...state[kind], data } }))
  }

  const defineList = (kind: EntryKind, page = 1) => {
    const key = `list:${kind}:${page}`
    queries.define({
      key,
      dependencies: dependencies(kind),
      load: () => services[kind].fetchPaginated(page, fetchLimits[kind]),
      onData: (data) => projectRecord(kind, data),
    })
    return key
  }

  const ensureList = (kind: EntryKind, page = 1) =>
    queries.ensure<EntryRecord[]>(defineList(kind, page))

  const dismissWarning = (id: string) =>
    ui.setState(({ warnings }) => ({
      warnings: warnings.filter((warning) => warning.id !== id),
    }))

  const warnRefresh = (operationId: string, key: string, error: unknown) => {
    if (disposed) return
    const id = `${operationId}:${key}`
    const [queryKind, entityKind] = key.split(':')
    const label =
      queryKindToLabel[queryKind] ??
      queryKindToLabel[entityKind] ??
      entityKind ??
      'related data'
    logger.error(`Follow-up refresh failed (${id}): ${String(error)}`)
    ui.setState(({ warnings }) => ({
      warnings: [
        ...warnings.filter((warning) => warning.id !== id),
        {
          id,
          message: `Your changes were saved, but ${label} could not be refreshed.`,
          retry: async () => {
            try {
              await queries.ensure(key)
              dismissWarning(id)
            } catch (retryError) {
              logger.error(
                `Refresh retry failed (${id}): ${String(retryError)}`,
              )
            }
          },
        },
      ],
    }))
  }

  const invalidate = async (
    operationId: string,
    kinds: EntryKind[],
    extraKeys: string[] = [],
  ) => {
    const outcomes = await queries.invalidate(kinds, extraKeys)
    for (const { key, error } of outcomes)
      if (error) warnRefresh(operationId, key, error)
  }

  const context = {
    store,
    services,
    queries,
    tracking,
    ui,
    now: options.now ?? getNowMillis,
    logger,
    isDisposed: () => disposed,
    defineList,
    warnRefresh,
    publishTracking: () =>
      runtime.events.publish('tracking.changed', {
        taskId: tracking.getActiveTracking()?.taskId ?? null,
      }),
  }
  const runtime = createRuntime<
    FrontendCommands,
    FrontendEvents,
    typeof context
  >(context)

  // Reactions: what the frontend does in response to each event.
  const reactions = createReactions<typeof context>()
  for (const name of Object.keys(reactionRegistry) as (keyof FrontendEvents)[])
    runtime.events.on(name, async (eventName, event, reactionContext) => {
      for (const reactionName of reactionRegistry[name] ?? []) {
        const reaction = reactions[reactionName]
        if (!reaction) {
          logger.warn(`Reaction not found: ${reactionName}. Skipping...`)
          continue
        }
        try {
          await reaction(eventName, event as MutationEvent, reactionContext)
        } catch (error) {
          logger.error(
            `Reaction ${reactionName} failed for ${eventName}: ${String(error)}`,
          )
        }
      }
    })

  // Backend events are republished on the local bus, one at a time.
  transport.connect({
    onEvent: async (name, payload) => {
      if (disposed) return
      const outcomes = await runtime.events.publish(
        name as keyof FrontendEvents,
        payload as never,
      )
      for (const outcome of outcomes)
        if (outcome.status === 'rejected')
          logger.error(
            `Event listener failed (${name}): ${String(outcome.reason)}`,
          )
      operations.handled(
        (payload as MutationEvent | undefined)?.operationId,
        name,
      )
    },
    onResync: async () => {
      if (disposed) return
      logger.warn('Event stream resynchronising; reloading data')
      const loaded = allKinds.filter(
        (kind) => store.getState()[kind].data.length,
      )
      await invalidate(
        'resync',
        allKinds,
        loaded.map((kind) => defineList(kind)),
      )
    },
  })

  /**
   * Sends a mutation and waits until its events have been handled, so callers
   * observe the updated store. Falls back to reloading if the events are lost.
   */
  const send = async (command: MutationCommand, input: MutationInput) => {
    const verb = command.slice(command.indexOf('.') + 1) as MutationVerb
    const operationId = crypto.randomUUID()
    const operation = operations.begin(operationId, [
      command,
      `${input.kind}.${verb}`,
    ])
    try {
      await settlesWithin(transport.ready(), readyTimeoutMs)
      const result = await mutationVerbs[verb](services[input.kind], input, {
        operationId,
      })
      if (!(await settlesWithin(operation.settled, eventTimeoutMs))) {
        logger.warn(
          `No events received for ${command} (${operationId}); reloading ${input.kind}`,
        )
        await invalidate(operationId, [input.kind], [defineList(input.kind)])
      }
      return result
    } finally {
      operation.cancel()
    }
  }

  let lifecycleQueue: Promise<unknown> = Promise.resolve()
  const serialize = <T>(work: () => Promise<T>) => {
    const result = lifecycleQueue.then(work)
    lifecycleQueue = result.catch(() => {})
    return result
  }

  const transitionTask = async ({
    id,
    status,
    changes = {},
  }: Transition): Promise<EntryRecord> => {
    let session = tracking.getActiveTracking()
    if (
      status === ProgressStatus.IN_PROGRESS &&
      session &&
      session.taskId !== id
    ) {
      await transitionTask({
        id: session.taskId,
        status: ProgressStatus.PAUSED,
      })
      session = null
    }
    const task = await services.tasks.fetchById(id)
    const values: Record<string, unknown> = { ...changes, status }

    if (status === ProgressStatus.IN_PROGRESS)
      values.started_at = task.started_at ?? context.now()
    if (status === ProgressStatus.COMPLETED) values.completed_at = context.now()

    const stopsTracking =
      status !== ProgressStatus.IN_PROGRESS && session?.taskId === id

    if (stopsTracking && session) {
      values.spent_minutes =
        Number(task.spent_minutes ?? 0) +
        Math.ceil(Math.max(0, context.now() - session.startTime) / 60000)
    }

    const result = (await send('entity.change', {
      kind: 'tasks',
      action: 'update',
      id,
      changes: values,
    })) as EntryRecord

    if (stopsTracking) tracking.clear()
    if (
      status === ProgressStatus.IN_PROGRESS &&
      tracking.getActiveTracking()?.taskId !== id
    )
      tracking.start(id, context.now())
    await context.publishTracking()
    return result
  }

  runtime.commands.handle('task.transition', (_command, input) =>
    serialize(() => transitionTask(input)),
  )

  // Task status changes and deletions go through the serialized lifecycle;
  // tracking cleanup on delete is a reaction, so it applies to any source.
  const mutate = (command: MutationCommand, input: MutationInput) => {
    if (
      input.kind === 'tasks' &&
      command === 'entity.change' &&
      input.id &&
      input.changes?.status
    ) {
      return runtime.commands.execute('task.transition', {
        id: input.id,
        status: input.changes.status as ProgressStatus,
        changes: input.changes,
      })
    }
    if (
      input.kind === 'tasks' &&
      (command === 'entity.delete' || command === 'entity.deleteAll')
    )
      return serialize(() => send(command, input))
    return send(command, input)
  }

  for (const head of mutationHeads)
    for (const verb of Object.keys(mutationVerbs) as MutationVerb[]) {
      const name: MutationCommand = `${head}.${verb}`
      runtime.commands.handle(
        name,
        (_command, input) =>
          mutate(name, input) as Promise<
            FrontendCommands[MutationCommand]['result']
          >,
      )
    }

  runtime.commands.handle('brainDump.submit', async (_command, input) => {
    const { urls = [] } = input
    let { task } = input
    if (!task) {
      const outcomes = await Promise.allSettled(
        urls.map((url) =>
          runtime.commands.execute('entitySupporter.add', {
            kind: 'urls',
            action: 'create',
            changes: url,
          }),
        ),
      )
      return {
        failedUrls: urls.filter(
          (_, index) => outcomes[index].status === 'rejected',
        ),
      }
    }
    if (!task.area_id && !task.project_id && !task.goal_id) {
      const areas = await ensureList('areas')
      let area = areas.find(
        (row) => String(row.title).toLowerCase() === 'brain dump',
      )
      if (!area) {
        area = (await services.areas.search('Brain Dump')).find(
          (row) => String(row.title).toLowerCase() === 'brain dump',
        )
      }
      if (!area) throw new Error('Brain Dump area not found')
      task = { ...task, area_id: area.id }
    }
    await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: task,
    })
    return { failedUrls: [] }
  })

  const fetchList = async (kind: EntryKind, page = 1) => {
    const key = defineList(kind, page)
    queries.markStale(key)
    return queries.ensure<EntryRecord[]>(key)
  }

  const search = async (kind: EntryKind, term: string) => {
    const key = `search:${kind}:${term}`
    queries.define({
      key,
      dependencies: dependencies(kind),
      load: () => services[kind].search(term),
    })
    return queries.ensure<EntryRecord[]>(key)
  }

  const dispose = () => {
    disposed = true
    transport.close()
    operations.dispose()
    runtime.dispose()
    queries.dispose()
    ui.setState({ tracking: null, warnings: [] })
  }

  return {
    ...runtime,
    queries,
    ui,
    tracking,
    services,
    defineList,
    ensureList,
    dismissWarning,
    fetchList,
    search,
    dispose,
  }
}

export function dependencies(kind: EntryKind): EntryKind[] {
  const hydrated: EntryKind[] = [
    'tasks',
    'projects',
    'areas',
    'goals',
    'resources',
  ]
  return kind === 'tasks'
    ? [...hydrated, 'tags', 'urls', 'time_entries']
    : hydrated.includes(kind)
      ? [...hydrated, 'tags', 'urls']
      : [kind]
}

export type FrontendRuntime = ReturnType<typeof createFrontendRuntime>
let instances = new WeakMap<StoreApi<StoreState>['getState'], FrontendRuntime>()
const liveInstances = new Set<FrontendRuntime>()

export function getFrontendRuntime(store: StoreApi<StoreState>) {
  let runtime = instances.get(store.getState)
  if (!runtime) {
    runtime = createFrontendRuntime(store)
    instances.set(store.getState, runtime)
    liveInstances.add(runtime)
  }
  return runtime
}

export function disposeFrontendRuntimes() {
  for (const runtime of liveInstances) runtime.dispose()
  liveInstances.clear()
  instances = new WeakMap()
}

if (import.meta.hot) import.meta.hot.dispose(disposeFrontendRuntimes)
