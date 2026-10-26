export type EntityKind =
  | 'tasks'
  | 'projects'
  | 'areas'
  | 'goals'
  | 'resources'
  | 'tags'
  | 'urls'
  | 'time_entries'
export type EntityRecord = { id: string } & Record<string, unknown>
export type MutationInput = {
  kind: EntityKind
  action: 'create' | 'update' | 'delete' | 'deleteAll'
  id?: string
  changes?: Record<string, unknown>
}
export type MutationResult = EntityRecord | { deleted: number }
export type MutationEvent = MutationInput & {
  operationId: string
  result: MutationResult
}
export type MutationCommands = {
  'entity.mutate': { input: MutationInput; result: MutationResult }
}
export type AppEvents = {
  'entity.changed': MutationEvent
  'tracking.changed': { taskId: string | null }
}
