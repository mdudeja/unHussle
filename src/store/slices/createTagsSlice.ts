import { EntityTag } from '@c/index'
import { TagsService } from '@/services/TagsService'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'

export interface TagsSlice {
  tags: DbSlice<EntityTag>
}

export const createTagsSlice = generateCreateDbConnectedStateSlice<
  EntityTag,
  'tags'
>(TagsService.getInstance(), 'tags')
