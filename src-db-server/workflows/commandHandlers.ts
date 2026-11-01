import { CommandHandlers } from '@c/workflows/contracts'

export const commandHandlerRegistry: CommandHandlers = {
  'entry.add': ['createRow'],
  'entry.change': ['updateRow'],
  'entry.delete': ['deleteRow'],
  'entry.deleteAll': ['deleteAllRows'],
  'entity.add': [
    'handler:entry.add',
    'validateTask',
    'trackTaskInterval',
    'updateSupporters',
    'updateSupporterCounts',
    'updateCollectionCounts',
    'markPlansStale',
  ],
  'entity.change': [
    'handler:entry.change',
    'validateTask',
    'trackTaskInterval',
    'updateSupporters',
    'updateSupporterCounts',
    'updateCollectionCounts',
    'markPlansStale',
    'syncPlanMembership',
  ],
  'entity.delete': [
    'handler:entry.delete',
    'deleteJunctions',
    'updateSupporterCounts',
    'updateCollectionCounts',
    'markPlansStale',
    'syncPlanMembership',
  ],
  'entity.deleteAll': [
    'handler:entry.deleteAll',
    'deleteJunctions',
    'updateSupporterCounts',
    'updateCollectionCounts',
    'markPlansStale',
    'syncPlanMembership',
  ],
  'entityCollection.add': [
    'handler:entry.add',
    'updateSupporters',
    'updateSupporterCounts',
  ],
  'entityCollection.change': [
    'handler:entry.change',
    'updateSupporters',
    'updateSupporterCounts',
    'announceAffectedEntities',
    'markPlansStale',
  ],
  'entityCollection.delete': [
    // Before the delete: member foreign keys are nulled once the row is gone.
    'announceAffectedEntities',
    'handler:entry.delete',
    'deleteJunctions',
    'updateSupporterCounts',
    'markPlansStale',
  ],
  'entityCollection.deleteAll': [
    // Before the delete: member foreign keys are nulled once the row is gone.
    'announceAffectedEntities',
    'handler:entry.deleteAll',
    'deleteJunctions',
    'updateSupporterCounts',
    'markPlansStale',
  ],
  // Only tag changes affect schedules; markPlansStale ignores other supporters.
  'entitySupporter.add': ['handler:entry.add', 'markPlansStale'],
  'entitySupporter.change': ['handler:entry.change', 'markPlansStale'],
  'entitySupporter.delete': [
    'handler:entry.delete',
    'deleteJunctions',
    'markPlansStale',
  ],
  'entitySupporter.deleteAll': [
    'handler:entry.deleteAll',
    'deleteJunctions',
    'markPlansStale',
  ],
}
