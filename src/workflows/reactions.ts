import type { StoreApi } from 'zustand/vanilla'
import type {
  EntryKind,
  EntryRecord,
  MutationEvent,
} from '@c/workflows/contracts'
import type { Handler } from '@c/workflows/runtime'
import type { Logger } from '@c/Logger'
import type { StoreState } from '@/store'
import type { QueryCoordinator } from './queries'
import type { createTracking } from './tracking'
import type { EntryTransport, ReactionName } from './contracts'

/** What reactions may use; the frontend runtime context satisfies it. */
export type ReactionContext = {
  store: StoreApi<StoreState>
  services: Record<EntryKind, EntryTransport>
  queries: QueryCoordinator
  tracking: ReturnType<typeof createTracking>
  logger: Logger
  isDisposed: () => boolean
  defineList: (kind: EntryKind, page?: number) => string
  warnRefresh: (operationId: string, key: string, error: unknown) => void
  publishTracking: () => Promise<unknown>
}

export type Reaction<Context> = Handler<MutationEvent, void, Context>

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
        context.logger.warn(`Could not reload ${kind} ${id}: ${String(error)}`)
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

export function createReactions<Context extends ReactionContext>() {
  const reactions: { [K in ReactionName]?: Reaction<Context> } = {
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
        for (const kind of ['tags', 'urls'] as const) {
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
