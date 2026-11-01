import { createStore, type StoreApi } from 'zustand/vanilla'
import { createRuntime, type TraceMeta } from '@c/workflows/runtime'
import type { SpanScope, Telemetry } from '@c/workflows/telemetry'
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
import { createQueryCoordinator, type QueryDependency } from './queries'
import {
  schedulerCommandEvents,
  schedulerCommandNames,
} from '@c/scheduler/contracts'
import { schedulerService, type SchedulerTransport } from '@/services/scheduler'
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
import { createReactions, schedulerEventDependencies } from './reactions'
import { reactionRegistry } from './reactionRegistry'
import { frontendTelemetry } from './telemetry'
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
    telemetry?: Telemetry
    scheduler?: SchedulerTransport
  } = {},
) {
  let disposed = false
  const logger = Logger.getInstance()
  const telemetry = options.telemetry ?? frontendTelemetry
  const queries = createQueryCoordinator({ telemetry })
  const operations = createOperationTracker()
  const scheduler = options.scheduler ?? schedulerService
  const transport = options.transport ?? createSseTransport({ telemetry })
  // Local operations in flight, so their events join the command's trace.
  const traces = new Map<string, TraceMeta>()
  const traceOf = (operationId: string | undefined): TraceMeta =>
    (operationId && traces.get(operationId)) || { traceId: operationId }
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
    const { traceId } = traceOf(operationId)
    telemetry.signal(
      'refresh.failed',
      { key: `${queryKind}:${entityKind}` },
      { traceId, error },
    )
    logger.error(`Follow-up refresh failed (${id})`, { error, traceId })
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
              logger.error(`Refresh retry failed (${id})`, {
                error: retryError,
              })
            }
          },
        },
      ],
    }))
  }

  const invalidate = async (
    operationId: string,
    kinds: QueryDependency[],
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
  >(context, { telemetry })

  // Reactions: what the frontend does in response to each event.
  const reactions = createReactions<typeof context>()
  for (const name of Object.keys(reactionRegistry) as (keyof FrontendEvents)[])
    runtime.events.on(
      name,
      async (eventName, event, reactionContext, listener) => {
        for (const reactionName of reactionRegistry[name] ?? []) {
          const reaction = reactions[reactionName]
          if (!reaction) {
            logger.warn(`Reaction not found: ${reactionName}. Skipping...`)
            continue
          }
          try {
            await telemetry.span(
              'reaction',
              reactionName,
              (span) =>
                reaction(
                  eventName,
                  event as MutationEvent,
                  reactionContext,
                  span,
                ),
              {
                traceId: listener?.traceId,
                parentId: listener?.spanId,
                attrs: { event: eventName },
              },
            )
          } catch (error) {
            logger.error(`Reaction ${reactionName} failed for ${eventName}`, {
              error,
              traceId: listener?.traceId,
            })
          }
        }
      },
      { label: 'reactions' },
    )

  // Backend events are republished on the local bus, one at a time.
  transport.connect({
    onEvent: async (name, payload) => {
      if (disposed) return
      const operationId = (payload as MutationEvent | undefined)?.operationId
      const meta = traceOf(operationId)
      const outcomes = await runtime.events.publish(
        name as keyof FrontendEvents,
        payload as never,
        meta,
      )
      for (const outcome of outcomes)
        if (outcome.status === 'rejected')
          logger.error(`Event listener failed (${name})`, {
            error: outcome.reason,
            traceId: meta.traceId,
          })
      operations.handled(operationId, name)
    },
    onResync: async () => {
      if (disposed) return
      telemetry.signal('stream.resync')
      logger.warn('Event stream resynchronising; reloading data')
      const loaded = allKinds.filter(
        (kind) => store.getState()[kind].data.length,
      )
      await invalidate(
        'resync',
        [...allKinds, 'schedule', 'occurrences', 'schedulerSettings'],
        loaded.map((kind) => defineList(kind)),
      )
    },
  })

  /**
   * Sends a mutation and waits until its events have been handled, so callers
   * observe the updated store. Falls back to reloading if the events are lost.
   */
  const send = async (
    command: MutationCommand,
    input: MutationInput,
    trace?: SpanScope,
  ) => {
    const verb = command.slice(command.indexOf('.') + 1) as MutationVerb
    const operationId = crypto.randomUUID()
    const traceId = trace?.traceId ?? operationId
    const child = { traceId, parentId: trace?.spanId }
    trace?.setAttrs({ kind: input.kind, operationId })
    traces.set(operationId, child)
    const operation = operations.begin(operationId, [
      command,
      `${input.kind}.${verb}`,
    ])
    try {
      await telemetry.span(
        'wait',
        'stream.ready',
        (span) =>
          settlesWithin(transport.ready(), readyTimeoutMs).then((ready) => {
            span.setAttrs({ ready })
          }),
        child,
      )
      const result = await telemetry.span(
        'http',
        command,
        (span) =>
          mutationVerbs[verb](services[input.kind], input, {
            operationId,
            traceId,
            parentSpanId: span.spanId,
          }),
        { ...child, attrs: { kind: input.kind, verb } },
      )
      const settled = await telemetry.span(
        'wait',
        'events.settle',
        (span) =>
          settlesWithin(operation.settled, eventTimeoutMs).then((settled) => {
            span.setAttrs({ settled })
            return settled
          }),
        child,
      )
      if (!settled) {
        telemetry.signal(
          'events.timeout',
          { command, kind: input.kind, timeoutMs: eventTimeoutMs },
          child,
        )
        logger.warn(
          `No events received for ${command} (${operationId}); reloading ${input.kind}`,
          { traceId },
        )
        await invalidate(operationId, [input.kind], [defineList(input.kind)])
      }
      return result
    } finally {
      operation.cancel()
      traces.delete(operationId)
    }
  }

  /** A mutation sent from inside another command, with its own command span. */
  const sendNested = (
    command: MutationCommand,
    input: MutationInput,
    parent?: SpanScope,
  ) =>
    telemetry.span('command', command, (span) => send(command, input, span), {
      traceId: parent?.traceId,
      parentId: parent?.spanId,
    })

  let lifecycleQueue: Promise<unknown> = Promise.resolve()
  const serialize = <T>(work: () => Promise<T>) => {
    const result = lifecycleQueue.then(work)
    lifecycleQueue = result.catch(() => {})
    return result
  }

  for (const command of schedulerCommandNames)
    runtime.commands.handle(command, (_name, input, _context, trace) =>
      serialize(async () => {
        const operationId = crypto.randomUUID()
        const traceId = trace?.traceId ?? operationId
        const event = schedulerCommandEvents[command]
        const operation = operations.begin(operationId, [event])
        traces.set(operationId, { traceId, parentId: trace?.spanId })
        try {
          // Ordinary task tracking remains serialized with occurrence
          // transitions; a break pauses the tracked task like any other.
          if (
            (command === 'occurrence.transition' &&
              'status' in input &&
              input.status === ProgressStatus.IN_PROGRESS) ||
            (command === 'scheduler.mode.change' &&
              'change' in input &&
              input.change === 'startBreak')
          ) {
            const session = tracking.getActiveTracking()
            if (session)
              await transitionTask(
                { id: session.taskId, status: ProgressStatus.PAUSED },
                trace,
              )
          }
          await settlesWithin(transport.ready(), readyTimeoutMs)
          const result = await telemetry.span(
            'http',
            command,
            (span) =>
              scheduler.execute(command, input, {
                operationId,
                traceId,
                parentSpanId: span.spanId,
              }),
            { traceId, parentId: trace?.spanId },
          )
          if (!(await settlesWithin(operation.settled, eventTimeoutMs))) {
            telemetry.signal(
              'events.timeout',
              { command, timeoutMs: eventTimeoutMs },
              { traceId },
            )
            await invalidate(operationId, schedulerEventDependencies[event])
          }
          // A corrected one-off interval has stopped, so its session ends too.
          if (
            command === 'tracking.stop' &&
            'taskId' in input &&
            !input.occurrenceId &&
            tracking.getActiveTracking()?.taskId === input.taskId
          ) {
            tracking.clear()
            await context.publishTracking()
          }
          return result
        } finally {
          operation.cancel()
          traces.delete(operationId)
        }
      }),
    )

  const transitionTask = async (
    { id, status, changes = {} }: Transition,
    trace?: SpanScope,
  ): Promise<EntryRecord> => {
    let session = tracking.getActiveTracking()
    if (
      status === ProgressStatus.IN_PROGRESS &&
      session &&
      session.taskId !== id
    ) {
      await transitionTask(
        { id: session.taskId, status: ProgressStatus.PAUSED },
        trace,
      )
      session = null
    }
    // The backend stamps lifecycle times and owns tracked minutes.
    const values: Record<string, unknown> = { ...changes, status }
    const stopsTracking =
      status !== ProgressStatus.IN_PROGRESS && session?.taskId === id

    const result = (await sendNested(
      'entity.change',
      { kind: 'tasks', action: 'update', id, changes: values },
      trace,
    )) as EntryRecord

    if (stopsTracking) tracking.clear()
    if (
      status === ProgressStatus.IN_PROGRESS &&
      tracking.getActiveTracking()?.taskId !== id
    )
      tracking.start(id, context.now())
    await context.publishTracking()
    return result
  }

  runtime.commands.handle(
    'task.transition',
    (_command, input, _context, trace) =>
      serialize(() => transitionTask(input, trace)),
  )

  // Task status changes and deletions go through the serialized lifecycle;
  // tracking cleanup on delete is a reaction, so it applies to any source.
  const mutate = (
    command: MutationCommand,
    input: MutationInput,
    trace?: SpanScope,
  ) => {
    if (
      input.kind === 'tasks' &&
      command === 'entity.change' &&
      input.id &&
      input.changes?.status
    ) {
      return runtime.commands.execute(
        'task.transition',
        {
          id: input.id,
          status: input.changes.status as ProgressStatus,
          changes: input.changes,
        },
        { traceId: trace?.traceId, parentId: trace?.spanId },
      )
    }
    if (
      input.kind === 'tasks' &&
      (command === 'entity.delete' || command === 'entity.deleteAll')
    )
      return serialize(() => send(command, input, trace))
    return send(command, input, trace)
  }

  for (const head of mutationHeads)
    for (const verb of Object.keys(mutationVerbs) as MutationVerb[]) {
      const name: MutationCommand = `${head}.${verb}`
      runtime.commands.handle(
        name,
        (_command, input, _context, trace) =>
          mutate(name, input, trace) as Promise<
            FrontendCommands[MutationCommand]['result']
          >,
      )
    }

  runtime.commands.handle(
    'brainDump.submit',
    async (_command, input, _context, trace) => {
      const nested = { traceId: trace?.traceId, parentId: trace?.spanId }
      const { urls = [] } = input
      let { task } = input
      if (!task) {
        const outcomes = await Promise.allSettled(
          urls.map((url) =>
            runtime.commands.execute(
              'entitySupporter.add',
              { kind: 'urls', action: 'create', changes: url },
              nested,
            ),
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
      await runtime.commands.execute(
        'entity.add',
        { kind: 'tasks', action: 'create', changes: task },
        nested,
      )
      return { failedUrls: [] }
    },
  )

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
    scheduler,
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
