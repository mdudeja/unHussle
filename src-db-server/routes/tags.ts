import { tags } from '@d/database/schemas'
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
})
