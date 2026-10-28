export type EntityKind = 'tasks' | 'resources'
export type EntityCollectionKind = 'projects' | 'areas' | 'goals'
export type EntitySupporterKind = 'tags' | 'urls' | 'time_entries'

export type EntryKind = EntityKind | EntityCollectionKind | EntitySupporterKind

export type EntryRecord = { id: string } & Record<string, unknown>

export type MutationInput = {
  kind: EntryKind
  action: 'create' | 'update' | 'delete' | 'deleteAll'
  id?: string
  changes?: Record<string, unknown>
}
export type MutationResult = EntryRecord | { deleted: number }
export type MutationEvent = MutationInput & {
  operationId: string
  result: MutationResult
}
export type MutationCommands = {
  'entry.mutate': { input: MutationInput; result: MutationResult }
}

export type AppEvents = {
  'entry.changed': MutationEvent
  'tracking.changed': { taskId: string | null }
}
