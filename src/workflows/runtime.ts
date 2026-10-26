import { createStore, type StoreApi } from 'zustand/vanilla'
import { createRuntime } from '@c/workflows/runtime'
import type {
  AppEvents,
  EntityKind,
  EntityRecord,
  MutationCommands,
  MutationInput,
  MutationResult,
} from '@c/workflows/contracts'
import {
  ProgressStatus,
  type Task,
  type WithAttachments,
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

export type EntityTransport = {
  create(this: void, changes: Record<string, unknown>): Promise<EntityRecord>
  update(
    this: void,
    id: string,
    changes: Record<string, unknown>,
  ): Promise<EntityRecord>
  delete(this: void, id: string): Promise<EntityRecord>
  reset(this: void): Promise<unknown>
  fetchPaginated(
    this: void,
    page: number,
    size: number,
  ): Promise<EntityRecord[]>
  fetchById(this: void, id: string): Promise<EntityRecord>
  search(this: void, term: string): Promise<EntityRecord[]>
}
type Transition = {
  id: string
  status: ProgressStatus
  changes?: Record<string, unknown>
}
type Commands = MutationCommands & {
  'task.transition': { input: Transition; result: EntityRecord }
  'brainDump.submit': {
    input: { task?: WithAttachments<Task['Write']>; urls?: UrlInput[] }
    result: { failedUrls: UrlInput[] }
  }
}

export function createFrontendRuntime(
  store: StoreApi<StoreState>,
  options: {
    services?: Record<EntityKind, EntityTransport>
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
  const services: Record<EntityKind, EntityTransport> =
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
  const project = (kind: EntityKind, data: EntityRecord[]) => {
    if (disposed) return
    store.setState((state) => ({ [kind]: { ...state[kind], data } }))
  }
  const defineList = (kind: EntityKind, page = 1) => {
    const key = `list:${kind}:${page}`
    queries.define({
      key,
      dependencies: dependencies(kind),
      load: () => services[kind].fetchPaginated(page, fetchLimits[kind]),
      onData: (data) => project(kind, data),
    })
    return key
  }
  const ensureList = (kind: EntityKind, page = 1) =>
    queries.ensure<EntityRecord[]>(defineList(kind, page))
  const dismissWarning = (id: string) =>
    ui.setState(({ warnings }) => ({
      warnings: warnings.filter((warning) => warning.id !== id),
    }))
  const warnRefresh = (operationId: string, key: string, error: unknown) => {
    if (disposed) return
    const id = `${operationId}:${key}`
    const [queryKind, entityKind] = key.split(':')
    const label =
      queryKind === 'search'
        ? 'search results'
        : queryKind === 'related'
          ? 'related tasks'
          : queryKind === 'tagged'
            ? 'tagged items'
            : queryKind === 'detail'
              ? 'item details'
              : entityKind === 'urls'
                ? 'links'
                : entityKind === 'time_entries'
                  ? 'time entries'
                  : (entityKind ?? 'related data')
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
  runtime.events.on('entity.changed', async (event) => {
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
    if (action === 'create') result = await service.create(changes)
    else if (action === 'update' && id)
      result = await service.update(id, changes)
    else if (action === 'delete' && id) result = await service.delete(id)
    else if (action === 'deleteAll') {
      const response = await service.reset()
      result =
        response && typeof response === 'object' && 'deleted' in response
          ? (response as { deleted: number })
          : { deleted: 0 }
    } else throw new Error('An entity id is required')
    const rows = store.getState()[kind].data as EntityRecord[]
    project(
      kind,
      action === 'deleteAll'
        ? []
        : action === 'delete'
          ? rows.filter((row) => row.id !== id)
          : action === 'create'
            ? [
                ...rows.filter((row) => row.id !== (result as EntityRecord).id),
                result as EntityRecord,
              ]
            : rows.map((row) =>
                row.id === id ? (result as EntityRecord) : row,
              ),
    )
    const operationId = crypto.randomUUID()
    const outcomes = await runtime.events.publish('entity.changed', {
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
  }: Transition): Promise<EntityRecord> => {
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
    })) as EntityRecord
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
  runtime.commands.handle('entity.mutate', (input) => {
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
          runtime.commands.execute('entity.mutate', {
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
    await runtime.commands.execute('entity.mutate', {
      kind: 'tasks',
      action: 'create',
      changes: task,
    })
    return { failedUrls: [] }
  })
  return {
    ...runtime,
    queries,
    ui,
    tracking,
    services,
    defineList,
    ensureList,
    dismissWarning,
    async fetchList(kind: EntityKind, page = 1) {
      const key = defineList(kind, page)
      queries.markStale(key)
      return queries.ensure<EntityRecord[]>(key)
    },
    async search(kind: EntityKind, term: string) {
      const key = `search:${kind}:${term}`
      queries.define({
        key,
        dependencies: dependencies(kind),
        load: () => services[kind].search(term),
      })
      return queries.ensure<EntityRecord[]>(key)
    },
    dispose() {
      disposed = true
      runtime.dispose()
      queries.dispose()
      ui.setState({ tracking: null, warnings: [] })
    },
  }
}

export function dependencies(kind: EntityKind): EntityKind[] {
  const hydrated: EntityKind[] = [
    'tasks',
    'projects',
    'areas',
    'goals',
    'resources',
  ]
  return hydrated.includes(kind)
    ? [...hydrated, 'tags', 'urls', 'time_entries']
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
