import type { ReactionRegistry } from './contracts'

const upserted = ['upsertRows', 'invalidateDependents'] as const
const deleted = ['removeRows', 'invalidateDependents'] as const
const cleared = ['clearRows', 'invalidateDependents'] as const

// Generic store reactions hang off the command-family events so each mutation
// is handled once; kind events (`tasks.delete`) carry kind-specific behaviour.
export const reactionRegistry: ReactionRegistry = {
  'scheduler.changed': ['refreshSchedule'],
  'scheduler.mode.changed': ['refreshSchedule'],
  'scheduler.settings.changed': ['refreshSchedule'],
  'occurrence.changed': ['refreshSchedule'],
  'tracking.stopped': ['refreshSchedule'],
  'entity.add': [...upserted],
  'entity.change': [...upserted],
  'entity.delete': [...deleted],
  'entity.deleteAll': [...cleared],
  'entityCollection.add': [...upserted],
  'entityCollection.change': [...upserted],
  'entityCollection.delete': [...deleted],
  'entityCollection.deleteAll': [...cleared],
  'entitySupporter.add': [...upserted],
  'entitySupporter.change': [...upserted],
  'entitySupporter.delete': [...deleted],
  'entitySupporter.deleteAll': [...cleared],

  'tasks.delete': ['stopTrackingIfDeleted'],
  'tasks.deleteAll': ['stopTracking'],

  // Members of a changed or deleted collection, announced by the backend.
  'tasks.change': ['refreshAnnounced'],
  'resources.change': ['refreshAnnounced'],
  'projects.change': ['refreshAnnounced'],
  'goals.change': ['refreshAnnounced'],
}
