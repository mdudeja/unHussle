// Vault commands carry resource content, so their events only carry ids:
// content never reaches SSE frames, the replay buffer, logs or span attrs.

export type VaultInfo = {
  /** Absolute vault folder. */
  path: string
  /** `custom` when the user picked the folder. */
  source: 'custom' | 'default'
  resources: number
  missing: number
}

export type ResourceContent = {
  id: string
  /** `null` when the file is not in the vault. */
  content: string | null
  /** Hash of the content on disk; send it back as `baseHash` when saving. */
  content_hash: string | null
  missing: boolean
  /** Absolute path of the file. */
  path: string | null
}

export type RescanResult = {
  imported: number
  repaired: number
  /** Titles of resources whose file is still missing. */
  missing: string[]
}

export type VaultCommands = {
  'resource.content.save': {
    input: {
      id: string
      content: string
      /** Hash the client read; a different file on disk is a conflict. */
      baseHash?: string | null
      /** Overwrite even if the file changed on disk. */
      force?: boolean
      operationId?: string
    }
    result: { id: string; content_hash: string; updated_at: number }
  }
  'vault.rescan': {
    input: { operationId?: string }
    result: RescanResult
  }
  'vault.settings.change': {
    input: { path: string; operationId?: string }
    result: VaultInfo
  }
}

export type VaultEvents = {
  'resource.content.changed': { operationId: string; id: string }
  'vault.changed': { operationId: string }
}

export const vaultCommandEvents = {
  'resource.content.save': 'resource.content.changed',
  'vault.rescan': 'vault.changed',
  'vault.settings.change': 'vault.changed',
} as const satisfies { [K in keyof VaultCommands]: keyof VaultEvents }

export const vaultCommandNames = Object.keys(
  vaultCommandEvents,
) as (keyof VaultCommands)[]
