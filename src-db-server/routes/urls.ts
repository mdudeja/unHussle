import { urlsSchema } from '@d/database/schemas'
import {
  insertUrlsSchema,
  selectUrlsSchema,
  updateUrlsSchema,
} from '@d/database/validation'
import { routeGenerator } from '@d/routes/routegenerator'
import { eq } from 'drizzle-orm'
import { URL } from 'node:url'

const urlRoutes = routeGenerator({
  name: 'urls',
  prefix: '/urls',
  schemas: {
    insert: insertUrlsSchema,
    select: selectUrlsSchema,
    update: updateUrlsSchema,
    base: urlsSchema,
  },
})

urlRoutes

  .post(
    '/',
    async ({ body, set, db }) => {
      console.log(`Add url with id: `, body.id)
      const url = new URL(body.url)

      const urlParts = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
      }

      const result = await db
        .insert(urlsSchema)
        .values({ ...body, parts: urlParts })
        .returning()

      if (!result.length || !result[0]) {
        set.status = 500
        throw new Error('Failed to insert url')
      }

      return result[0]
    },
    {
      body: insertUrlsSchema,
      response: selectUrlsSchema,
    },
  )

  .patch(
    '/:id',
    async ({ params: { id }, body, set, db }) => {
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

      const result = await db
        .update(urlsSchema)
        .set(updatedBody)
        .where(eq(urlsSchema.id, id))
        .returning()
      if (!result.length || !result[0]) {
        set.status = 500
        throw new Error('Failed to update url')
      }
      return result[0]
    },
    {
      body: updateUrlsSchema,
      response: selectUrlsSchema,
    },
  )

export { urlRoutes }
