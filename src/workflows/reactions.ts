import type { StoreApi } from 'zustand/vanilla'
import type {
  EntryKind,
  EntryRecord,
  MutationEvent,
} from '@c/workflows/contracts'
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
  'resource.content.changed': ['resourceContent'],
  // A rescan imports rows and a folder move changes every path.
  'vault.changed': ['resources', 'resourceContent', 'vault'],
}

const setRows = (
  { store, isDisposed }: ReactionContext,
  kind: EntryKind,
  update: (rows: EntryRecord[]) => EntryRecord[],
) => {
  if (isDisposed()) return
  store.setState((state) => ({
    [kind]: { ...state[kind], data: update(state[kind].data) },
  }))
}

const resultIds = ({ result, id }: MutationEvent) =>
  Array.isArray(result)
    ? result.map((row) => row.id)
    : result
      ? [result.id]
      : id
        ? [id]
        : []

/** Reloads rows so the store holds hydrated records (events carry raw rows). */
const loadAndUpsert = async (
  context: ReactionContext,
  kind: EntryKind,
  ids: string[],
) => {
  const rows = await Promise.all(
    ids.map((id) =>
      context.services[kind].fetchById(id).catch((error: unknown) => {
        context.logger.warn(`Could not reload ${kind} ${id}`, { error })
        return null
      }),
    ),
  )
  const loaded = rows.filter((row): row is EntryRecord => row !== null)
  if (loaded.length === 0) return
  setRows(context, kind, (current) => {
    const byId = new Map(loaded.map((row) => [row.id, row]))
    const next = current.map((row) => byId.get(row.id) ?? row)
    for (const row of loaded)
      if (!current.some((existing) => existing.id === row.id)) next.push(row)
    return next
  })
}

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
  const refresh = async () => {
    const task = await context.services.tasks.fetchById(session.taskId)
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
      const outcomes = await context.queries.invalidate(
        schedulerEventDependencies[name as keyof SchedulerEvents] ?? [
          'schedule',
        ],
      )
      for (const { key, error } of outcomes)
        if (error) context.warnRefresh(event.operationId, key, error)
    },
    // Content events only carry the resource id; its row (hash, updated_at)
    // is reloaded if the store holds it.
    refreshVault: async (name, event, context) => {
      const { id } = event as unknown as { id?: string }
      if (
        id &&
        context.store.getState().resources.data.some((row) => row.id === id)
      )
        await loadAndUpsert(context, 'resources', [id])
      const outcomes = await context.queries.invalidate(
        vaultEventDependencies[name as keyof VaultEvents] ?? ['vault'],
        name === 'vault.changed' ? [context.defineList('resources')] : [],
      )
      for (const { key, error } of outcomes)
        if (error) context.warnRefresh(event.operationId, key, error)
    },

    upsertRows: async (_name, event, context) => {
      await loadAndUpsert(context, event.kind, resultIds(event))
    },

    removeRows: (_name, event, context) => {
      const ids = new Set(resultIds(event))
      setRows(context, event.kind, (rows) =>
        rows.filter((row) => !ids.has(row.id)),
      )
    },

    clearRows: (_name, event, context) => {
      const ids = Array.isArray(event.result)
        ? new Set(event.result.map((row) => row.id))
        : undefined
      setRows(context, event.kind, (rows) =>
        ids ? rows.filter((row) => !ids.has(row.id)) : [],
      )
    },

    invalidateDependents: async (_name, event, context) => {
      const extra: string[] = []
      if (event.action === 'create' || event.action === 'update') {
        for (const kind of ['tags', 'urls', 'resources'] as const) {
          if (event.changes?.[kind] !== undefined)
            extra.push(context.defineList(kind))
        }
      }
      const outcomes = await context.queries.invalidate([event.kind], extra)
      for (const { key, error } of outcomes)
        if (error) context.warnRefresh(event.operationId, key, error)
    },

    // Announcements carry `attachedIds` and no result; direct changes are
    // already handled by the command-family reactions.
    refreshAnnounced: async (_name, event, context) => {
      if (event.result !== undefined || !event.attachedIds?.length) return
      const known = new Set(
        (context.store.getState()[event.kind].data as EntryRecord[]).map(
          (row) => row.id,
        ),
      )
      await loadAndUpsert(
        context,
        event.kind,
        event.attachedIds.filter((id) => known.has(id)),
      )
      const outcomes = await context.queries.invalidate([event.kind])
      for (const { key, error } of outcomes)
        if (error) context.warnRefresh(event.operationId, key, error)
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
