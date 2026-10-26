import { Tag } from '@c/types/index'
import generateCreateDbConnectedStateSlice, {
  DbSlice,
} from '@/store/slices/createDbConnectedStoreSlice'

export interface TagsSlice {
  tags: DbSlice<Tag>
}

export const createTagsSlice = generateCreateDbConnectedStateSlice<Tag, 'tags'>(
  'tags',
)
