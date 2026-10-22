import { UrlsRepository } from '@d/database/repositories/urls'
import { urls } from '@d/database/schemas'
import { UnHussleDB } from '@d/database/UnHussleDB'
import {
  insertUrlsSchema,
  selectUrlsSchema,
  updateUrlsSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'
import { toUrlParts } from '@d/database/repositories/helpers'

const repository = new UrlsRepository(UnHussleDB.getInstance())

const urlRoutes = routeGenerator({
  name: 'urls',
  prefix: '/urls',
  schemas: {
    insert: insertUrlsSchema,
    select: selectUrlsSchema,
    update: updateUrlsSchema,
    base: urls,
  },
  repository: repository,
})

urlRoutes

  .post(
    '/',
    async ({ body, set, logger }) => {
      logger.debug(`Add url with id: ${body.id}`)
      const result = await repository.add({
        ...body,
        parts: toUrlParts(body.url),
      })

      if (!result) {
        set.status = 500
        throw new Error('Failed to insert url')
      }

      return result
    },
    {
      body: insertUrlsSchema,
      response: selectUrlsSchema,
    },
  )

  .patch(
    '/:id',
    async ({ params: { id }, body, set }) => {
      console.log(`Update url with id: `, id)
      let updatedBody = body

      if (body.url) {
        updatedBody = { ...body, parts: toUrlParts(body.url) }
      }

      const result = await repository.update(id, updatedBody)
      if (!result) {
        set.status = 500
        throw new Error('Failed to update url')
      }
      return result
    },
    {
      body: updateUrlsSchema,
      response: selectUrlsSchema,
    },
  )

export { urlRoutes }
