import { Elysia } from 'elysia'
import { Value } from '@sinclair/typebox/value'
import { backendRuntime, type createBackendRuntime } from '@d/workflows/runtime'
import { Logger } from '@c/Logger'
import { UnHussleDB } from '@d/database/UnHussleDB'
import {
  changeVaultSchema,
  rescanResultSchema,
  vaultInfoSchema,
} from '@d/database/validation'
import { vaultInfo } from '@d/domain/vault'
import { VaultConflict, VaultError } from '@d/vault/vault'
import { operationIdHeader, traceOf } from './telemetry'

export function createVaultRoutes(
  database: UnHussleDB,
  runtime: ReturnType<typeof createBackendRuntime>,
) {
  return new Elysia({ prefix: '/vault', name: 'vault' })
    .decorate('logger', Logger.getInstance())
    .onError(({ code, error, status, logger }) => {
      logger.error(`Error in vault route (${code})`, { error })
      // Vault errors explain what the user can do, so their message is returned.
      const known =
        error instanceof VaultError || error instanceof VaultConflict
      return status(error instanceof VaultConflict ? 409 : known ? 400 : 500, {
        message: known ? error.message : 'Unable to update the vault',
      })
    })

    .get(
      '/',
      async () =>
        Value.Parse(
          vaultInfoSchema,
          vaultInfo(await database.getDb(), runtime.vault),
        ),
      { response: vaultInfoSchema },
    )

    .post(
      '/rescan',
      async ({ headers, request }) =>
        Value.Parse(
          rescanResultSchema,
          await runtime.commands.execute(
            'vault.rescan',
            { operationId: headers[operationIdHeader] },
            traceOf(request),
          ),
        ),
      { response: rescanResultSchema },
    )

    .patch(
      '/',
      async ({ body, headers, request }) =>
        Value.Parse(
          vaultInfoSchema,
          await runtime.commands.execute(
            'vault.settings.change',
            { ...body, operationId: headers[operationIdHeader] },
            traceOf(request),
          ),
        ),
      { body: changeVaultSchema, response: vaultInfoSchema },
    )
}

export const vaultRoutes = createVaultRoutes(
  UnHussleDB.getInstance(),
  backendRuntime,
)
