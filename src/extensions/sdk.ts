/** Public frontend authoring surface (`unhussle/frontend`). */
import type { ComponentType } from 'react'
import type { Disposable, Extension } from '@c/extensions/sdk'
import type { EntryKind } from '@c/workflows/contracts'
import { useEntryList, useEntryDetail, useEntrySearch } from '@/workflows/hooks'
export type {
  ApplicationServices,
  JsonValue,
  WorkflowDefinition,
} from '@c/extensions/sdk'

type ReadonlyData<T> = T extends object
  ? { readonly [K in keyof T]: ReadonlyData<T[K]> }
  : T

// Query results belong to the coordinator; edits go in local drafts.
const readonly = <Q extends { data: unknown }>(query: Q) =>
  query as Q & { data: ReadonlyData<Q['data']> }

export function useExtensionEntries(kind: EntryKind, page = 1, enabled = true) {
  return readonly(useEntryList(kind, page, enabled))
}
export function useExtensionDetail(
  kind: EntryKind,
  id: string,
  enabled = true,
) {
  return readonly(useEntryDetail(kind, id, enabled))
}
export function useExtensionSearch<T extends { id: string }>(
  kind: EntryKind,
  term: string,
) {
  return readonly(useEntrySearch<T>(kind, term))
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
  menus: { register: (menu: ExtensionMenu) => Disposable }
  views: { register: (view: ExtensionView) => Disposable }
}
export type FrontendExtension = Extension<FrontendContributions>
