import { createStore, type StoreApi } from 'zustand/vanilla'
import { createRuntime } from '@c/workflows/runtime'
import type {
  AppEvents,
  EntryKind,
  EntryRecord,
  MutationCommands,
  MutationInput,
  MutationResult,
} from '@c/workflows/contracts'
import {
  ProgressStatus,
  type Task,
  type WithSupporters,
  type UrlInput,
} from '@c/types'
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

export type EntryTransport = {
  create(this: void, changes: Record<string, unknown>): Promise<EntryRecord>
  update(
    this: void,
    id: string,
    changes: Record<string, unknown>,
  ): Promise<EntryRecord>
  delete(this: void, id: string): Promise<EntryRecord>
  reset(this: void): Promise<unknown>
  fetchPaginated(this: void, page: number, size: number): Promise<EntryRecord[]>
  fetchById(this: void, id: string): Promise<EntryRecord>
  search(this: void, term: string): Promise<EntryRecord[]>
}
type Transition = {
  id: string
  status: ProgressStatus
  changes?: Record<string, unknown>
}
type Commands = MutationCommands & {
  'task.transition': { input: Transition; result: EntryRecord }
  'brainDump.submit': {
    input: { task?: WithSupporters<Task['Write']>; urls?: UrlInput[] }
    result: { failedUrls: UrlInput[] }
  }
}

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
  } = {},
) {
  let disposed = false
  const queries = createQueryCoordinator()
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

  const context = {
    store,
    services,
    queries,
    tracking,
    ui,
    now: options.now ?? getNowMillis,
    logger: Logger.getInstance(),
  }
  const runtime = createRuntime<Commands, AppEvents, typeof context>(context)
  let lifecycleQueue: Promise<unknown> = Promise.resolve()

  const serialize = <T>(work: () => Promise<T>) => {
    const result = lifecycleQueue.then(work)
    lifecycleQueue = result.catch(() => {})
    return result
  }

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
    context.logger.error(`Follow-up refresh failed (${id}): ${String(error)}`)
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
              context.logger.error(
                `Refresh retry failed (${id}): ${String(retryError)}`,
              )
            }
          },
        },
      ],
    }))
  }

  runtime.events.on('entry.changed', async (event) => {
    const extra: string[] = []
    if (event.action === 'create' || event.action === 'update') {
      for (const kind of ['tags', 'urls'] as const) {
        if (event.changes?.[kind] !== undefined) extra.push(defineList(kind))
      }
    }
    const outcomes = await queries.invalidate([event.kind], extra)
    for (const { key, error } of outcomes)
      if (error) warnRefresh(event.operationId, key, error)
  })

  const publishTracking = () =>
    runtime.events.publish('tracking.changed', {
      taskId: tracking.getActiveTracking()?.taskId ?? null,
    })

  const mutate = async (input: MutationInput): Promise<MutationResult> => {
    const { kind, action, id, changes = {} } = input
    const service = services[kind]
    let result: MutationResult
    switch (action) {
      case 'create':
        result = await service.create(changes)
        break
      case 'update':
        if (!id) throw new Error('Missing id for update action')
        result = await service.update(id, changes)
        break
      case 'delete':
        if (!id) throw new Error('Missing id for delete action')
        result = await service.delete(id)
        break
      case 'deleteAll':
        // eslint-disable-next-line no-case-declarations
        const response = await service.reset()
        result =
          response && typeof response === 'object' && 'deleted' in response
            ? (response as { deleted: number })
            : { deleted: 0 }
        break
      default:
        throw new Error('Unsupported mutation action')
    }
    const rows = store.getState()[kind].data as EntryRecord[]
    projectRecord(
      kind,
      action === 'deleteAll'
        ? []
        : action === 'delete'
          ? rows.filter((row) => row.id !== id)
          : action === 'create'
            ? [
                ...rows.filter((row) => row.id !== (result as EntryRecord).id),
                result as EntryRecord,
              ]
            : rows.map((row) =>
                row.id === id ? (result as EntryRecord) : row,
              ),
    )
    const operationId = crypto.randomUUID()
    const outcomes = await runtime.events.publish('entry.changed', {
      ...input,
      result,
      operationId,
    })
    for (const outcome of outcomes)
      if (outcome.status === 'rejected') {
        context.logger.error(
          `Completion listener failed (${operationId}): ${String(outcome.reason)}`,
        )
      }
    return result
  }

  const transition = async ({
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
      await transition({ id: session.taskId, status: ProgressStatus.PAUSED })
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

    const result = (await mutate({
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
    await publishTracking()
    return result
  }

  runtime.commands.handle('task.transition', (input) =>
    serialize(() => transition(input)),
  )

  runtime.commands.handle('entry.mutate', (input) => {
    if (
      input.kind === 'tasks' &&
      input.action === 'update' &&
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
      (input.action === 'delete' || input.action === 'deleteAll')
    ) {
      return serialize(async () => {
        const result = await mutate(input)
        if (
          input.action === 'deleteAll' ||
          tracking.getActiveTracking()?.taskId === input.id
        ) {
          tracking.clear()
          await publishTracking()
        }
        return result
      })
    }
    return mutate(input)
  })

  runtime.commands.handle('brainDump.submit', async ({ task, urls = [] }) => {
    if (!task) {
      const outcomes = await Promise.allSettled(
        urls.map((url) =>
          runtime.commands.execute('entry.mutate', {
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
    await runtime.commands.execute('entry.mutate', {
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
