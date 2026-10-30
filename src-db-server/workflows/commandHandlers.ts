import { CommandHandlers } from '@c/workflows/contracts'

export const commandHandlerRegistry: CommandHandlers = {
  'entry.add': ['createRow'],
  'entry.change': ['updateRow'],
  'entry.delete': ['deleteRow'],
  'entry.deleteAll': ['deleteAllRows'],
  'entity.add': [
    'handler:entry.add',
    'updateSupporters',
    'updateSupporterCounts',
    'updateCollectionCounts',
  ],
  'entity.change': [
    'handler:entry.change',
    'updateSupporters',
    'updateSupporterCounts',
    'updateCollectionCounts',
  ],
  'entity.delete': [
    'handler:entry.delete',
    'deleteJunctions',
    'updateSupporterCounts',
    'updateCollectionCounts',
  ],
  'entity.deleteAll': [
    'handler:entry.deleteAll',
    'deleteJunctions',
    'updateSupporterCounts',
    'updateCollectionCounts',
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
  ],
  'entityCollection.delete': [
    // Before the delete: member foreign keys are nulled once the row is gone.
    'announceAffectedEntities',
    'handler:entry.delete',
    'deleteJunctions',
    'updateSupporterCounts',
  ],
  'entityCollection.deleteAll': [
    // Before the delete: member foreign keys are nulled once the row is gone.
    'announceAffectedEntities',
    'handler:entry.deleteAll',
    'deleteJunctions',
    'updateSupporterCounts',
  ],
  'entitySupporter.add': ['handler:entry.add'],
  'entitySupporter.change': ['handler:entry.change'],
  'entitySupporter.delete': ['handler:entry.delete', 'deleteJunctions'],
  'entitySupporter.deleteAll': ['handler:entry.deleteAll', 'deleteJunctions'],
}
