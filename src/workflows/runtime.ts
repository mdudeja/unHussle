import { createStore, type StoreApi } from 'zustand/vanilla'
import { createRuntime } from '@c/workflows/runtime'
import type { SpanScope, Telemetry } from '@c/workflows/telemetry'
import type {
  EntryKind,
  EntryRecord,
  MutationEvent,
  MutationInput,
} from '@c/workflows/contracts'
import { ProgressStatus } from '@c/types/enums'
import { getNowMillis } from '@c/datetimeUtils'
import { Logger } from '@c/Logger'
import type { StoreState } from '@/store'
import { createQueryCoordinator, type QueryDependency } from './queries'
import {
  schedulerCommandEvents,
  schedulerCommandNames,
} from '@c/scheduler/contracts'
import { schedulerService, type SchedulerTransport } from '@/services/scheduler'
import { vaultCommandEvents, vaultCommandNames } from '@c/vault/contracts'
import { vaultService, type VaultTransport } from '@/services/vault'
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
import { createEventTransport, type EventTransport } from './eventStream'
import { createCommandTransport } from './commandTransport'
import { createInvalidationBatcher } from './invalidation'
import {
  createReactions,
  schedulerEventDependencies,
  vaultEventDependencies,
  syncTrackedTask,
} from './reactions'
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
  tracking: 'timer',
  urls: 'links',
  time_entries: 'time entries',
}

/** Creates the frontend runtime that connects the application store to backend services and event streams, coordinating commands, reactions, tracking, and cached queries for the frontend. */
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
    vault?: VaultTransport
  } = {},
) {
  let disposed = false
  const logger = Logger.getInstance()
  const telemetry = options.telemetry ?? frontendTelemetry
  const queries = createQueryCoordinator({ telemetry })
  const scheduler = options.scheduler ?? schedulerService
  const vault = options.vault ?? vaultService
  const transport = options.transport ?? createEventTransport({ telemetry })
  const commandTransport = createCommandTransport({
    transport,
    telemetry,
    eventTimeoutMs: options.eventTimeoutMs ?? 3000,
    readyTimeoutMs: options.readyTimeoutMs ?? 1000,
  })
  const traceOf = commandTransport.traceOf
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

  /** Defines the query used to load a paginated list of entries so the list can be fetched and managed consistently by the query system. */
  const defineList = (kind: EntryKind, page = 1) => {
    const key = `list:${kind}:${page}`
    queries.define({
      key,
      dependencies: dependencies(kind),
      load: () => services[kind].fetchPaginated(page, fetchLimits[kind]),
    })
    return key
  }

  /** Defines a cached detail query for a specific entry kind and identifier, returning the key used to access that entry’s fetched details. */
  const defineDetail = (kind: EntryKind, id: string) => {
    const key = `detail:${kind}:${id}`
    queries.define({
      key,
      dependencies: dependencies(kind),
      load: () => services[kind].fetchById(id),
    })
    return key
  }

  /** Ensures the requested entry list is available. */
  const ensureList = (kind: EntryKind, page = 1) =>
    queries.ensure<EntryRecord[]>(defineList(kind, page))

  /** Dismisses a warning by removing it from the active warnings. */
  const dismissWarning = (id: string) =>
    ui.setState(({ warnings }) => ({
      warnings: warnings.filter((warning) => warning.id !== id),
    }))

  /** Warns that changes were saved but related data failed to refresh, and provides a way to retry the refresh. */
  const warnRefresh = (
    operationId: string,
    key: string,
    error: unknown,
    retry?: () => Promise<unknown>,
  ) => {
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
              if (retry) await retry()
              else await queries.ensure(key)
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

  /** Invalidates cached query data for the specified dependency kinds and extra keys, warning about any refresh failures. */
  const invalidate = async (
    operationId: string,
    kinds: QueryDependency[],
    extraKeys: string[] = [],
  ) => {
    const outcomes = await queries.invalidate(kinds, extraKeys)
    for (const { key, error } of outcomes)
      if (error) warnRefresh(operationId, key, error)
  }

  const invalidations = createInvalidationBatcher(invalidate, {
    isPending: (id) => commandTransport.pending(id),
  })

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
    defineDetail,
    invalidate: (
      operationId: string,
      kinds: QueryDependency[],
      complete?: boolean,
    ) => invalidations.invalidate(operationId, kinds, complete),
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
      commandTransport.handled(operationId, name)
    },
    onResync: async () => {
      if (disposed) return
      telemetry.signal('stream.resync')
      logger.warn('Event stream resynchronising; reloading data')
      await invalidate('resync', [
        ...allKinds,
        'schedule',
        'occurrences',
        'schedulerSettings',
        'resourceContent',
        'vault',
      ])
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
    const { result } = await commandTransport.send(
      {
        command,
        expectedEvents: [command, `${input.kind}.${verb}`],
        request: (options) =>
          mutationVerbs[verb](services[input.kind], input, options),
        recover: (operationId) =>
          invalidations.invalidate(operationId, [input.kind], true),
        attrs: { kind: input.kind, verb },
      },
      trace,
    )
    return result
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
  /** Serializes asynchronous work by queuing tasks so they run sequentially in order, preventing overlap. */
  const serialize = <T>(work: () => Promise<T>) => {
    const result = lifecycleQueue.then(work)
    lifecycleQueue = result.catch(() => {})
    return result
  }

  for (const command of schedulerCommandNames)
    runtime.commands.handle(command, (_name, input, _context, trace) =>
      serialize(async () => {
        const event = schedulerCommandEvents[command]
        const { result, operationId } = await commandTransport.send(
          {
            command,
            expectedEvents: [event],
            request: (options) => scheduler.execute(command, input, options),
            recover: (operationId) =>
              invalidations.invalidate(
                operationId,
                schedulerEventDependencies[event],
                true,
              ),
          },
          trace,
        )
        // Only committed scheduler work can end the local presentation session.
        if (
          (command === 'scheduler.occurrence.transition' &&
            'status' in input &&
            input.status === ProgressStatus.IN_PROGRESS) ||
          (command === 'scheduler.mode.change' &&
            'change' in input &&
            input.change === 'startBreak')
        ) {
          await syncTrackedTask(context, operationId)
        }
        // A corrected one-off interval has stopped, so its session ends too.
        if (
          command === 'scheduler.tracking.stop' &&
          'taskId' in input &&
          !input.occurrenceId &&
          tracking.getActiveTracking()?.taskId === input.taskId
        ) {
          tracking.clear()
          await context.publishTracking()
        }
        return result
      }),
    )

  // Saves of one resource go out one at a time, so an older save can never
  // land after a newer one. Other vault commands share one queue.
  const vaultQueues = new Map<string, Promise<unknown>>()
  /** Ensures asynchronous work queued under the same key runs sequentially, preventing overlapping tasks for that key while allowing different keys to proceed independently. */
  const queueVault = <T>(key: string, work: () => Promise<T>) => {
    const result = (vaultQueues.get(key) ?? Promise.resolve()).then(work)
    const tail = result.catch(() => {})
    vaultQueues.set(key, tail)
    void tail.then(() => {
      if (vaultQueues.get(key) === tail) vaultQueues.delete(key)
    })
    return result
  }

  for (const command of vaultCommandNames)
    runtime.commands.handle(command, (_name, input, _context, trace) =>
      queueVault(
        command === 'resource.content.save'
          ? `content:${(input as { id: string }).id}`
          : 'vault',
        async () => {
          const event = vaultCommandEvents[command]
          const { result } = await commandTransport.send(
            {
              command,
              expectedEvents: [event],
              request: (options) => vault.execute(command, input, options),
              recover: (operationId) =>
                invalidations.invalidate(
                  operationId,
                  vaultEventDependencies[event],
                  true,
                ),
            },
            trace,
          )
          return result
        },
      ),
    )

  /** Transitions a task to a new status and applies requested changes while keeping active tracking aligned with the task’s progress. */
  const transitionTask = async (
    { id, status, changes = {} }: Transition,
    trace?: SpanScope,
  ): Promise<EntryRecord> => {
    const session = tracking.getActiveTracking()
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

  /** Fetches the list of entries for the requested kind and page, ensuring cached data is refreshed when needed. */
  const fetchList = async (kind: EntryKind, page = 1) => {
    const key = defineList(kind, page)
    queries.markStale(key)
    return queries.ensure<EntryRecord[]>(key)
  }

  /** Searches entries of a specified kind for the given term. */
  const search = async (kind: EntryKind, term: string) => {
    const key = `search:${kind}:${term}`
    queries.define({
      key,
      dependencies: dependencies(kind),
      load: () => services[kind].search(term),
    })
    return queries.ensure<EntryRecord[]>(key)
  }

  /** Releases all resources and shuts down active services cleanly. */
  const dispose = () => {
    disposed = true
    transport.close()
    commandTransport.dispose()
    invalidations.dispose()
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
    vault,
    defineList,
    defineDetail,
    ensureList,
    dismissWarning,
    fetchList,
    search,
    dispose,
  }
}

/** Identifies the entry kinds associated with the given entry kind for dependency tracking. */
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
      : kind === 'time_entries'
        ? ['time_entries', 'tasks']
        : [...hydrated, 'tags', 'urls']
}

export type FrontendRuntime = ReturnType<typeof createFrontendRuntime>
let instances = new WeakMap<StoreApi<StoreState>['getState'], FrontendRuntime>()
const liveInstances = new Set<FrontendRuntime>()

/** Retrieves the shared frontend runtime for a store, creating and registering it when one does not already exist. */
export function getFrontendRuntime(store: StoreApi<StoreState>) {
  let runtime = instances.get(store.getState)
  if (!runtime) {
    runtime = createFrontendRuntime(store)
    instances.set(store.getState, runtime)
    liveInstances.add(runtime)
  }
  return runtime
}

/** Disposes all active frontend runtimes and clears the tracking of live instances. */
export function disposeFrontendRuntimes() {
  for (const runtime of liveInstances) runtime.dispose()
  liveInstances.clear()
  instances = new WeakMap()
}

if (import.meta.hot) import.meta.hot.dispose(disposeFrontendRuntimes)
