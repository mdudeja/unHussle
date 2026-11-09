import { Value } from '@sinclair/typebox/value'
import { TagsRepository } from '@d/database/repositories/tags'
import { SupporterItemsRepository } from '@d/database/repositories/supporterItems'
import { tags } from '@d/database/schemas'
import { UnHussleDB } from '@d/database/UnHussleDB'
import {
  insertTagsSchema,
  selectSupporterItemsSchema,
  selectTagsSchema,
  updateTagsSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'

const uDB = UnHussleDB.getInstance()
const repository = new TagsRepository(uDB)
const items = new SupporterItemsRepository(uDB)

const tagRoutes = routeGenerator({
  name: 'tags',
  prefix: '/tags',
  kind: 'tags',
  schemas: {
    insert: insertTagsSchema,
    select: selectTagsSchema,
    update: updateTagsSchema,
    base: tags,
  },
  repository: repository,
})

tagRoutes.get(
  '/:id/items',
  async ({ params: { id }, logger }) => {
    logger.debug(`Get items tagged with tag id: ${id}`)
    return Value.Parse(
      selectSupporterItemsSchema,
      await items.getItems('tags', id),
    )
  },
  {
    response: selectSupporterItemsSchema,
  },
)

export { tagRoutes }
