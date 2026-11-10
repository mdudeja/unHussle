/** Public frontend authoring surface. No store or mutable workflow runtime exports. */
import type { ComponentType } from 'react'
import type {
  ApplicationServices,
  Disposable,
  Extension,
  Override,
} from '@c/extensions/sdk'
export { SDK_VERSION } from '@c/extensions/sdk'
export type {
  ApplicationServices,
  JsonValue,
  WorkflowDefinition,
} from '@c/extensions/sdk'
import { useEntryList, useEntryDetail, useEntrySearch } from '@/workflows/hooks'
import type { EntryKind } from '@c/workflows/contracts'

type ReadonlyData<T> = T extends object
  ? { readonly [K in keyof T]: ReadonlyData<T[K]> }
  : T

/** Read-only views of coordinator-owned results; drafts belong in local UI state. */
export function useExtensionEntries<K extends EntryKind>(
  kind: K,
  page = 1,
  enabled = true,
) {
  const query = useEntryList(kind, page, enabled)
  return { ...query, data: query.data as ReadonlyData<typeof query.data> }
}
/** Provides a read-only query for the details of a specified extension entry. */
export function useExtensionDetail(
  kind: EntryKind,
  id: string,
  enabled = true,
) {
  const query = useEntryDetail(kind, id, enabled)
  const data: ReadonlyData<typeof query.data> = query.data
  return { ...query, data }
}
/** Searches extensions of a given entry kind by term and provides the resulting search query state with read-only data. */
export function useExtensionSearch<T extends { id: string }>(
  kind: EntryKind,
  term: string,
) {
  const query = useEntrySearch<T>(kind, term)
  return { ...query, data: query.data as ReadonlyData<typeof query.data> }
}
export type ExtensionMenu = { id: string; label: string } & (
  | { viewId: string; run?: never }
  | { run: () => void | Promise<void>; viewId?: never }
)
export type ExtensionView = {
  id: string
  label: string
  component: ComponentType
}
export type FrontendContributions = {
  menus: { register: (menu: ExtensionMenu, options?: Override) => Disposable }
  views: { register: (view: ExtensionView, options?: Override) => Disposable }
}
export type FrontendExtension = Extension<
  ApplicationServices,
  FrontendContributions
>
