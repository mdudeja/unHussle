import { Elysia, t } from 'elysia'
import { backendRuntime, type createBackendRuntime } from '@d/bootstrap'
import { Logger } from '@c/Logger'
import { extensionListSchema } from '@c/extensions/manifest'
import { ExtensionError } from '@d/extensions/manager'

/** Lists, enables and reloads extensions found in the extensions folder. */
export function createExtensionRoutes(
  runtime: ReturnType<typeof createBackendRuntime>,
) {
  const manager = runtime.extensionManager
  return new Elysia({ prefix: '/extensions', name: 'extensions' })
    .decorate('logger', Logger.getInstance())
    .onError(({ code, error, status, logger }) => {
      logger.error(`Error in extensions route (${code})`, { error })
      if (code === 'VALIDATION') return
      // These explain what the user can do, so their message is returned.
      const known = error instanceof ExtensionError
      return status(known ? 400 : 500, {
        message: known ? error.message : 'Unable to update extensions',
      })
    })

    .get('/', () => manager.list(), { response: extensionListSchema })

    .patch('/', ({ body }) => manager.setDirectory(body.directory), {
      body: t.Object({ directory: t.String({ minLength: 1 }) }),
      response: extensionListSchema,
    })

    .post('/rescan', () => manager.rescan(), { response: extensionListSchema })

    .put(
      '/:id/enabled',
      ({ params, body }) => manager.setEnabled(params.id, body.enabled),
      {
        body: t.Object({ enabled: t.Boolean() }),
        response: extensionListSchema,
      },
    )

    .get(
      '/:id/frontend.js',
      async ({ params }) =>
        new Response(await manager.frontendBundle(params.id), {
          headers: { 'Content-Type': 'text/javascript; charset=utf-8' },
        }),
    )
}

export const extensionRoutes = createExtensionRoutes(backendRuntime)
