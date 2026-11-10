import type { ReactionRegistry } from './contracts'

// Query invalidation belongs on family completions; kind events retain only
// tracking behavior and dependent-change announcements.
const changed = ['invalidateDependents'] as const

export const reactionRegistry: ReactionRegistry = {
  'scheduler.changed': ['refreshSchedule'],
  'scheduler.mode.changed': ['refreshSchedule', 'syncTracking'],
  'scheduler.settings.changed': ['refreshSchedule'],
  'scheduler.occurrence.changed': ['refreshSchedule', 'syncTracking'],
  'scheduler.tracking.stopped': ['refreshSchedule', 'syncTracking'],
  'resource.content.changed': ['refreshVault'],
  'vault.changed': ['refreshVault'],
  'entity.add': [...changed],
  'entity.change': [...changed],
  'entity.delete': [...changed],
  'entity.deleteAll': [...changed],
  'entityCollection.add': [...changed],
  'entityCollection.change': [...changed],
  'entityCollection.delete': [...changed],
  'entityCollection.deleteAll': [...changed],
  'entitySupporter.add': [...changed],
  'entitySupporter.change': [...changed],
  'entitySupporter.delete': [...changed],
  'entitySupporter.deleteAll': [...changed],

  'tasks.delete': ['stopTrackingIfDeleted'],
  'tasks.deleteAll': ['stopTracking'],

  // Members of a changed or deleted collection, announced by the backend.
  'tasks.change': ['refreshAnnounced', 'syncTracking'],
  'resources.change': ['refreshAnnounced'],
  'projects.change': ['refreshAnnounced'],
  'areas.change': ['refreshAnnounced'],
  'goals.change': ['refreshAnnounced'],
}
