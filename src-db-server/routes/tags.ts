import { TagsRepository } from '@d/database/repositories/tags'
import { tags } from '@d/database/schemas'
import { UnHussleDB } from '@d/database/UnHussleDB'
import {
  insertTagsSchema,
  selectTagsSchema,
  updateTagsSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'

export const tagRoutes = routeGenerator({
  name: 'tags',
  prefix: '/tags',
  schemas: {
    insert: insertTagsSchema,
    select: selectTagsSchema,
    update: updateTagsSchema,
    base: tags,
  },
  repository: new TagsRepository(UnHussleDB.getInstance()),
})
