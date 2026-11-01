import type { VaultActionName, VaultCommand } from '@d/workflows/vaultActions'

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
