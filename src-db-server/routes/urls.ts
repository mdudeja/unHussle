import { urlsSchema } from '@d/database/schemas'
import {
  insertUrlsSchema,
  selectUrlsSchema,
  updateUrlsSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'

export const urlRoutes = routeGenerator({
  name: 'urls',
  prefix: '/urls',
  schemas: {
    insert: insertUrlsSchema,
    select: selectUrlsSchema,
    update: updateUrlsSchema,
    base: urlsSchema,
  },
})
