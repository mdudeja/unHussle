import type { ExtensionList } from '@c/extensions/manifest'
import { apiAddress } from '@/lib/apiAddress'
import { makeJSONRequest } from '@/lib/server'

const base = apiAddress('extensions')

export const extensionService = {
  list: () => makeJSONRequest<ExtensionList>({ url: base, method: 'GET' }),
  rescan: () =>
    makeJSONRequest<ExtensionList>({ url: `${base}/rescan`, method: 'POST' }),
  setEnabled: (id: string, enabled: boolean) =>
    makeJSONRequest<ExtensionList>({
      url: `${base}/${encodeURIComponent(id)}/enabled`,
      method: 'PUT',
      body: { enabled },
    }),
  setDirectory: (directory: string) =>
    makeJSONRequest<ExtensionList>({
      url: base,
      method: 'PATCH',
      body: { directory },
    }),
  /** Unique per call, so a reload fetches freshly built code. */
  frontendUrl: (id: string) =>
    `${base}/${encodeURIComponent(id)}/frontend.js?t=${Date.now()}`,
}
