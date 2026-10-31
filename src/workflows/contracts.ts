import type {
  AppEvents,
  EntryRecord,
  MutationCommands,
} from '@c/workflows/contracts'
import type { ProgressStatus, Task, UrlInput, WithSupporters } from '@c/types'
import type { MutationOptions } from '@/services/database/DbService'

/** Backend events (received over SSE) plus frontend-only events. */
export type FrontendEvents = AppEvents & {
  'tracking.changed': { taskId: string | null }
}

export type Transition = {
  id: string
  status: ProgressStatus
  changes?: Record<string, unknown>
}

/** Mutation commands exposed by the backend routes, plus frontend workflows. */
export type FrontendCommands = Pick<
  MutationCommands,
  Exclude<keyof MutationCommands, `entry.${string}`>
> & {
  'task.transition': { input: Transition; result: EntryRecord }
  'brainDump.submit': {
    input: { task?: WithSupporters<Task['Write']>; urls?: UrlInput[] }
    result: { failedUrls: UrlInput[] }
  }
}

export type EntryTransport = {
  create(
    this: void,
    changes: Record<string, unknown>,
    options?: MutationOptions,
  ): Promise<EntryRecord>
  update(
    this: void,
    id: string,
    changes: Record<string, unknown>,
    options?: MutationOptions,
  ): Promise<EntryRecord>
  delete(
    this: void,
    id: string,
    options?: MutationOptions,
  ): Promise<EntryRecord>
  reset(this: void, options?: MutationOptions): Promise<unknown>
  fetchPaginated(this: void, page: number, size: number): Promise<EntryRecord[]>
  fetchById(this: void, id: string): Promise<EntryRecord>
  search(this: void, term: string): Promise<EntryRecord[]>
}

export type ReactionName =
  | 'upsertRows'
  | 'removeRows'
  | 'clearRows'
  | 'invalidateDependents'
  | 'refreshAnnounced'
  | 'stopTrackingIfDeleted'
  | 'stopTracking'

/** Which reactions run, in order, for each event. Mirrors the backend `CommandHandlers`. */
export type ReactionRegistry = {
  [K in keyof FrontendEvents]?: ReactionName[]
}
