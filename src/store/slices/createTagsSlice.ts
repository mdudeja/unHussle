import { Tag } from '@c/index'
import { TagsService } from '@/services/TagsService'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'

export interface TagsSlice {
  tags: DbSlice<Tag>
}

export const createTagsSlice = generateCreateDbConnectedStateSlice<Tag, 'tags'>(
  TagsService.getInstance(),
  'tags',
)
