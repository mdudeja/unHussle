import { apiAddress } from '@/lib/apiAddress'
import type {
  ResourceContent,
  VaultCommands,
  VaultInfo,
} from '@c/vault/contracts'
import { makeJSONRequest } from '@/lib/server'
import {
  mutationHeaders,
  type MutationOptions,
} from '@/services/database/DbService'

/** Resource content and vault folder; content never travels in entity rows. */
export type VaultTransport = {
  info(): Promise<VaultInfo>
  content(id: string): Promise<ResourceContent>
  execute<K extends keyof VaultCommands>(
    name: K,
    input: VaultCommands[K]['input'],
    options: MutationOptions,
  ): Promise<VaultCommands[K]['result']>
}

const base = apiAddress()

export const vaultService: VaultTransport = {
  info: () => makeJSONRequest({ url: `${base}/vault`, method: 'GET' }),
  content: (id) =>
    makeJSONRequest({
      url: `${base}/resources/${encodeURIComponent(id)}/content`,
      method: 'GET',
    }),
  execute: (name, input, options) => {
    const headers = mutationHeaders(options)
    if (name === 'resource.content.save') {
      const {
        id,
        operationId: _operationId,
        ...body
      } = input as VaultCommands['resource.content.save']['input']
      return makeJSONRequest({
        url: `${base}/resources/${encodeURIComponent(id)}/content`,
        method: 'PUT',
        body,
        headers,
      })
    }
    if (name === 'vault.rescan')
      return makeJSONRequest({
        url: `${base}/vault/rescan`,
        method: 'POST',
        headers,
      })
    const { path } = input as VaultCommands['vault.settings.change']['input']
    return makeJSONRequest({
      url: `${base}/vault`,
      method: 'PATCH',
      body: { path },
      headers,
    })
  },
}
