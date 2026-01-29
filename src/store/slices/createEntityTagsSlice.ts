import { EntityTag } from '@c/index'
import { EntityTagsService } from '@/services/EntityTagsService'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'

export interface EntityTagsSlice {
  entity_tags: DbSlice<EntityTag>
}

export const createEntityTagsSlice = generateCreateDbConnectedStateSlice<
  EntityTag,
  'entity_tags'
>(EntityTagsService.getInstance(), 'entity_tags')
