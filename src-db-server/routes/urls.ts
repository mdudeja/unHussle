import { UrlsRepository } from '@d/database/repositories/urls'
import { urls } from '@d/database/schemas'
import { UnHussleDB } from '@d/database/UnHussleDB'
import {
  insertUrlsSchema,
  selectUrlsSchema,
  updateUrlsSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'
const repository = new UrlsRepository(UnHussleDB.getInstance())

const urlRoutes = routeGenerator({
  name: 'urls',
  prefix: '/urls',
  kind: 'urls',
  schemas: {
    insert: insertUrlsSchema,
    select: selectUrlsSchema,
    update: updateUrlsSchema,
    base: urls,
  },
  repository: repository,
})

export { urlRoutes }
