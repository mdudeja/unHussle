import { UrlsRepository } from '@d/database/repositories/urls'
import { urls } from '@d/database/schemas'
import { UnHussleDB } from '@d/database/UnHussleDB'
import {
  insertUrlsSchema,
  selectUrlsSchema,
  selectSupporterItemsSchema,
  updateUrlsSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'
import { SupporterItemsRepository } from '@d/database/repositories/supporterItems'
import { Value } from '@sinclair/typebox/value'
const database = UnHussleDB.getInstance()
const repository = new UrlsRepository(database)
const items = new SupporterItemsRepository(database)

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

urlRoutes.get(
  '/:id/items',
  async ({ params: { id } }) =>
    Value.Parse(selectSupporterItemsSchema, await items.getItems('urls', id)),
  { response: selectSupporterItemsSchema },
)

export { urlRoutes }
