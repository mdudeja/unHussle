import type { ExtensionList } from '@c/extensions/manifest'
import type { JsonValue } from '@c/extensions/sdk'
import { apiAddress } from '@/lib/apiAddress'
import { makeJSONRequest } from '@/lib/server'

const base = apiAddress('extensions')
const settingUrl = (id: string, key: string) =>
  `${base}/${encodeURIComponent(id)}/settings/${encodeURIComponent(key)}`
type Setting = { value?: JsonValue }

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
  getSetting: async (id: string, key: string) =>
    (
      await makeJSONRequest<Setting>({
        url: settingUrl(id, key),
        method: 'GET',
      })
    ).value,
  setSetting: async (id: string, key: string, value: JsonValue) => {
    await makeJSONRequest<Setting>({
      url: settingUrl(id, key),
      method: 'PUT',
      body: { value },
    })
  },
  /** Unique per call, so a reload fetches freshly built code. */
  frontendUrl: (id: string) =>
    `${base}/${encodeURIComponent(id)}/frontend.js?t=${Date.now()}`,
}
