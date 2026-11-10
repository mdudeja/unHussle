import { t } from 'elysia'
import { Value } from '@sinclair/typebox/value'
import { eq } from 'drizzle-orm'
import {
  insertResourceSchema,
  resourceContentSchema,
  saveResourceContentSchema,
  savedResourceContentSchema,
  selectResourceSchema,
  updateResourceSchema,
} from '@d/database/validation'
import { routeGenerator } from './routegenerator'
import { resources } from '@d/database/schemas'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { ResourcesRepository } from '@d/database/repositories/resources'
import { backendRuntime } from '@d/workflows/runtime'
import { fileExists, readFile, resolveIn } from '@d/vault/vault'
import { operationIdHeader, traceOf } from '@d/routes/telemetry'

const uDB = UnHussleDB.getInstance()
const db = await uDB.getDb()
/** Returns the root location of the vault. */
const vaultRoot = () => backendRuntime.vault.root(db)

export const resourcesRoutes = routeGenerator({
  name: 'resources',
  prefix: '/resources',
  kind: 'resources',
  schemas: {
    insert: insertResourceSchema,
    select: selectResourceSchema,
    update: updateResourceSchema,
    base: resources,
  },
  repository: new ResourcesRepository(uDB, vaultRoot),
})
  // Content is read from disk on every request, so edits made outside the
  // app show up when a resource is opened.
  .get(
    '/:id/content',
    ({ params: { id } }) => {
      const row = db.select().from(resources).where(eq(resources.id, id)).get()
      if (!row) throw new Error('NOT_FOUND')
      const root = vaultRoot()
      const present = fileExists(root, row.file_path)
      const file =
        present && row.file_path
          ? readFile(resolveIn(root, row.file_path))
          : null
      return Value.Parse(resourceContentSchema, {
        id,
        content: file?.content ?? null,
        content_hash: file?.hash ?? null,
        missing: !file,
        path: row.file_path ? resolveIn(root, row.file_path) : null,
      })
    },
    { params: t.Object({ id: t.String() }), response: resourceContentSchema },
  )
  .put(
    '/:id/content',
    async ({ params: { id }, body, headers, request }) =>
      Value.Parse(
        savedResourceContentSchema,
        await backendRuntime.commands.execute(
          'resource.content.save',
          { ...body, id, operationId: headers[operationIdHeader] },
          traceOf(request),
        ),
      ),
    {
      params: t.Object({ id: t.String() }),
      body: saveResourceContentSchema,
      response: savedResourceContentSchema,
    },
  )
