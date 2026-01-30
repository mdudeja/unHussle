import { Tag } from '@c/index'
import { EntityTagsService } from '@/services/EntityTagsService'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'

export interface TagsSlice {
  tags: DbSlice<Tag>
}

export const createTagsSlice = generateCreateDbConnectedStateSlice<Tag, 'tags'>(
  EntityTagsService.getInstance(),
  'tags',
)
