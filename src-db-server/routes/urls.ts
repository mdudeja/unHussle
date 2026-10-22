import { UrlsRepository } from '@d/database/repositories/urls'
import { urls } from '@d/database/schemas'
import { UnHussleDB } from '@d/database/UnHussleDB'
import {
  insertUrlsSchema,
  selectUrlsSchema,
  updateUrlsSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'
import { URL } from 'node:url'

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
      const url = new URL(body.url)

      const urlParts = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
      }

      const result = await repository.add({ ...body, parts: urlParts })

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
        const url = new URL(body.url)

        const urlParts = {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port,
          pathname: url.pathname,
          search: url.search,
          hash: url.hash,
        }

        updatedBody = { ...body, parts: urlParts }
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
