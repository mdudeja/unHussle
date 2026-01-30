import {
  insertResourceSchema,
  selectResourceSchema,
  updateResourceSchema,
} from '@d/database/validation'
import { routeGenerator } from './routegenerator'
import { resourcesSchema } from '@d/database/schemas'

export const resourcesRoutes = routeGenerator({
  name: 'resources',
  prefix: '/resources',
  schemas: {
    insert: insertResourceSchema,
    select: selectResourceSchema,
    update: updateResourceSchema,
    base: resourcesSchema,
  },
})
