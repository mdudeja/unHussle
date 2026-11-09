import type { SyncTx } from '@d/database/repositories/helpers'
import type { VaultState } from './contracts'
import * as vault from '@d/domain/vault'

export type VaultActionName =
  | 'loadResource'
  | 'checkContentBase'
  | 'writeContent'
  | 'listVaultFiles'
  | 'repairMissing'
  | 'importUnindexed'
  | 'validateVaultTarget'
  | 'copyVault'
  | 'saveVaultSetting'

/** Synchronous; runs inside the command's transaction. */
export type VaultAction = (
  name: VaultActionName,
  state: VaultState,
  work: { tx: SyncTx },
) => void

/** Execution adapters; vault integrity operations are shared domain functions. */
export const vaultActions: Record<VaultActionName, VaultAction> = {
  loadResource: (_name, state, { tx }) => vault.loadResource(state, tx),
  checkContentBase: (_name, state) => vault.checkContentBase(state),
  writeContent: (_name, state, { tx }) => vault.writeContent(state, tx),
  listVaultFiles: (_name, state, { tx }) => vault.listVaultFiles(state, tx),
  repairMissing: (_name, state, { tx }) => vault.repairMissing(state, tx),
  importUnindexed: (_name, state, { tx }) => vault.importUnindexed(state, tx),
  validateVaultTarget: (_name, state, { tx }) =>
    vault.validateVaultTarget(state, tx),
  copyVault: (_name, state) => vault.copyVault(state),
  saveVaultSetting: (_name, state, { tx }) => vault.saveVaultSetting(state, tx),
}
