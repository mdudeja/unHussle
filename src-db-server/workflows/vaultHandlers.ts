import type { VaultActionName } from '@d/workflows/vaultActions'
import type { VaultCommand } from './contracts'

/** Ordered actions per vault command, like `schedulerHandlerRegistry`. */
export const vaultHandlerRegistry: Record<VaultCommand, VaultActionName[]> = {
  'resource.content.save': ['loadResource', 'checkContentBase', 'writeContent'],
  'vault.rescan': ['listVaultFiles', 'repairMissing', 'importUnindexed'],
  'vault.settings.change': [
    'validateVaultTarget',
    'copyVault',
    'saveVaultSetting',
  ],
}
