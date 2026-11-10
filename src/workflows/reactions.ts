import type { StoreApi } from 'zustand/vanilla'
import type { EntryKind, MutationEvent } from '@c/workflows/contracts'
import type { Handler } from '@c/workflows/runtime'
import type { Logger } from '@c/Logger'
import type { StoreState } from '@/store'
import type { QueryCoordinator, QueryDependency } from './queries'
import type { SchedulerEvents } from '@c/scheduler/contracts'
import type { VaultEvents } from '@c/vault/contracts'
import type { createTracking } from './tracking'
import type { EntryTransport, ReactionName } from './contracts'
import { ProgressStatus } from '@c/types/enums'

/** What reactions may use; the frontend runtime context satisfies it. */
export type ReactionContext = {
  store: StoreApi<StoreState>
  services: Record<EntryKind, EntryTransport>
  queries: QueryCoordinator
  tracking: ReturnType<typeof createTracking>
  logger: Logger
  isDisposed: () => boolean
  defineList: (kind: EntryKind, page?: number) => string
  defineDetail: (kind: EntryKind, id: string) => string
  invalidate: (
    operationId: string,
    dependencies: QueryDependency[],
    complete?: boolean,
  ) => Promise<void>
  warnRefresh: (
    operationId: string,
    key: string,
    error: unknown,
    retry?: () => Promise<unknown>,
  ) => void
  publishTracking: () => Promise<unknown>
}

export type Reaction<Context> = Handler<MutationEvent, void, Context>

/** Reads each scheduler event can change. Only occurrence tracking touches task rows. */
export const schedulerEventDependencies: Record<
  keyof SchedulerEvents,
  QueryDependency[]
> = {
  'scheduler.changed': ['schedule'],
  // Starting a break pauses running work, which changes its tracked time.
  'scheduler.mode.changed': [
    'schedule',
    'occurrences',
    'tasks',
    'time_entries',
  ],
  'scheduler.settings.changed': ['schedule', 'schedulerSettings'],
  'scheduler.occurrence.changed': [
    'schedule',
    'occurrences',
    'tasks',
    'time_entries',
  ],
  'scheduler.tracking.stopped': [
    'schedule',
    'occurrences',
    'tasks',
    'time_entries',
  ],
}

/** Reads each vault event can change. */
export const vaultEventDependencies: Record<
  keyof VaultEvents,
  QueryDependency[]
> = {
  'resource.content.changed': ['resources', 'resourceContent'],
  // A rescan imports rows and a folder move changes every path.
  'vault.changed': ['resources', 'resourceContent', 'vault'],
}

/** Extracts the identifiers of records affected by a mutation event. */
const resultIds = ({ result, id }: MutationEvent) =>
  Array.isArray(result)
    ? result.map((row) => row.id)
    : result
      ? [result.id]
      : id
        ? [id]
        : []

/** Stops tracking and publishes the cleared tracking state. */
const stopTracking = async ({ tracking, publishTracking }: ReactionContext) => {
  tracking.clear()
  await publishTracking()
}

/** Reconcile presentation after a committed backend transition; never retry the write. */
export async function syncTrackedTask(
  context: ReactionContext,
  operationId: string,
) {
  const session = context.tracking.getActiveTracking()
  if (!session) return
  /** Refreshes tracking for the current task, stopping it if the task is no longer in progress. */
  const refresh = async () => {
    const key = context.defineDetail('tasks', session.taskId)
    context.queries.markStale(key)
    const task =
      await context.queries.ensure<
        import('@c/workflows/contracts').EntryRecord
      >(key)
    if (
      task.status !== ProgressStatus.IN_PROGRESS &&
      context.tracking.getActiveTracking() === session
    )
      await stopTracking(context)
  }
  try {
    await refresh()
  } catch (error) {
    context.warnRefresh(
      operationId,
      `tracking:tasks:${session.taskId}`,
      error,
      refresh,
    )
  }
}

/** Creates the event reaction handlers that keep application state, cached queries, and tracking sessions synchronized with incoming domain events. */
export function createReactions<Context extends ReactionContext>() {
  const reactions: { [K in ReactionName]?: Reaction<Context> } = {
    // The persisted task decides whether a local timer still represents running work.
    syncTracking: async (name, event, context) => {
      const session = context.tracking.getActiveTracking()
      if (!session) return
      if (
        name === 'tasks.change' &&
        ![...resultIds(event), ...(event.attachedIds ?? [])].includes(
          session.taskId,
        )
      )
        return
      await syncTrackedTask(context, event.operationId)
    },
    refreshSchedule: async (name, event, context) => {
      await context.invalidate(
        event.operationId,
        schedulerEventDependencies[name as keyof SchedulerEvents] ?? [
          'schedule',
        ],
        true,
      )
    },
    refreshVault: async (name, event, context) => {
      await context.invalidate(
        event.operationId,
        vaultEventDependencies[name as keyof VaultEvents] ?? ['vault'],
        true,
      )
    },
    invalidateDependents: async (_name, event, context) => {
      await context.invalidate(event.operationId, [event.kind], true)
    },
    refreshAnnounced: async (_name, event, context) => {
      if (event.result !== undefined || !event.attachedIds?.length) return
      await context.invalidate(event.operationId, [event.kind])
    },

    stopTrackingIfDeleted: async (_name, event, context) => {
      const active = context.tracking.getActiveTracking()
      if (active && resultIds(event).includes(active.taskId))
        await stopTracking(context)
    },

    stopTracking: async (_name, _event, context) => {
      await stopTracking(context)
    },
  }

  return reactions
}
