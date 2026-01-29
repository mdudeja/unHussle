import { entityTagsSchema } from '@d/database/schemas'
import {
  insertEntityTagsSchema,
  selectEntityTagsSchema,
  updateEntityTagsSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'

export const entityTagRoutes = routeGenerator({
  name: 'entity_tags',
  prefix: '/entity_tags',
  schemas: {
    insert: insertEntityTagsSchema,
    select: selectEntityTagsSchema,
    update: updateEntityTagsSchema,
    base: entityTagsSchema,
  },
})
