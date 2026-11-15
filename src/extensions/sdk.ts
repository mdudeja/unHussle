/** Public frontend authoring surface (`unhussle/frontend`). */
import type { ComponentType } from 'react'
import type { Disposable, Extension } from '@c/extensions/sdk'
import type { EntityCollectionKind, EntryKind } from '@c/workflows/contracts'
import type {
  ContainerDetail,
  CollectionListItems,
  CollectionListOptions,
  ReadContainerKind,
  ReadPage,
  TaskPageOptions,
} from '@c/types/readModels'
import { dependencies } from '@/workflows/execution'
import { fetchContainerDetail, fetchCollections } from '@/services/readModels'
import { useStore } from '@/store'
import type { EntityKind } from '@/lib/entityActions'
import {
  useEntryList,
  useEntryDetail,
  useEntrySearch,
  useWorkflowQuery,
} from '@/workflows/hooks'

export * from '@/extensions/ui'
export { getEntityItemRoute } from '@/lib/entityRoutes'
export type {
  ApplicationServices,
  JsonValue,
  WorkflowDefinition,
} from '@c/extensions/sdk'
export type { ContainerDetail, TaskListItem } from '@c/types/readModels'
export { COLLECTION_PAGE_LIMIT } from '@c/types/readModels'
export type { CollectionListOptions } from '@c/types/readModels'
export { ProgressInput, ProgressStatus } from '@c/types/enums'
export type { CountProgress } from '@c/progress'

export type ReadonlyData<T> = T extends object
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

export type ContainerRequest = {
  kind: ReadContainerKind
  id: string
  options?: TaskPageOptions
}
/**
 * Several containers with a page of their tasks each, in request order.
 * Refreshes when any task or collection changes.
 */
export function useExtensionContainers(requests: ContainerRequest[]) {
  return readonly(
    useWorkflowQuery<ContainerDetail[]>({
      key: `related-many:${JSON.stringify(requests)}`,
      dependencies: [
        ...new Set(
          requests.flatMap(({ kind }) => [
            ...dependencies(kind),
            ...dependencies('tasks'),
          ]),
        ),
      ],
      load: () =>
        Promise.all(
          requests.map(({ kind, id, options }) =>
            fetchContainerDetail(kind, id, options),
          ),
        ),
    }),
  )
}

/**
 * A page of projects, areas or goals, in ID order. Filter by title, status,
 * or `customKey` (your extension ID) for items holding your `custom_data`.
 * Refreshes when that kind changes.
 */
export function useExtensionCollections<K extends EntityCollectionKind>(
  kind: K,
  options: CollectionListOptions = {},
) {
  return readonly(
    useWorkflowQuery<ReadPage<CollectionListItems[K]>>({
      key: `collections:${kind}:${JSON.stringify(options)}`,
      dependencies: dependencies(kind),
      load: () => fetchCollections(kind, options),
    }),
  )
}

/** Opens the app's edit dialog for an item. */
export const openEntityEditor = (kind: EntityKind, id: string) =>
  useStore.getState().openEditor(kind, id)

export type ExtensionMenu = { id: string; label: string } & (
  | { viewId: string; run?: never }
  | { run: () => void | Promise<void>; viewId?: never }
)
export type ExtensionView = {
  id: string
  label: string
  component: ComponentType
}
/**
 * What an extension shares with the ones that require it. Bump `version`
 * when its shape changes, so they can check they still fit.
 */
export type ProvidedExports = { version: number }
export type FrontendContributions = {
  menus: { register: (menu: ExtensionMenu) => Disposable }
  views: { register: (view: ExtensionView) => Disposable }
  /** Shares values while `activate` runs; needs `"exports": true`. */
  exports: { provide: <T extends ProvidedExports>(value: T) => void }
  /** What a required extension provided; only IDs in `requires`. */
  dependencies: { get: <T extends ProvidedExports>(id: string) => T }
}
export type FrontendExtension = Extension<FrontendContributions>
