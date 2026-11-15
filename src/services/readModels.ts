import { apiAddress } from '@/lib/apiAddress'
import { makeJSONRequest } from '@/lib/server'
import type { EntityCollectionKind, EntryKind } from '@c/workflows/contracts'
import {
  encodeSources,
  type ContainerDetail,
  type CollectionListItems,
  type CollectionListOptions,
  type EntityReference,
  type ReadContainerKind,
  type ReadPage,
  type TaskPageOptions,
} from '@c/types/readModels'

const address = apiAddress()

/** Serializes an options object into a URL-encoded query string, omitting undefined values. */
const params = (options: object) =>
  new URLSearchParams(
    Object.entries(options)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString()

/** Fetches detailed information about a specific container. */
export const fetchContainerDetail = (
  kind: ReadContainerKind,
  id: string,
  options: TaskPageOptions = {},
) =>
  makeJSONRequest<ContainerDetail>({
    url: `${address}/${kind}/${encodeURIComponent(id)}/detail?${params(options)}`,
    method: 'GET',
  })

/** A page of projects, areas or goals in ID order, filtered. */
export const fetchCollections = <K extends EntityCollectionKind>(
  kind: K,
  options: CollectionListOptions = {},
) =>
  makeJSONRequest<ReadPage<CollectionListItems[K]>>({
    url: `${address}/${kind}/collections?${params({
      ...options,
      sources: options.sources && encodeSources(options.sources),
    })}`,
    method: 'GET',
  })

/** Fetches references for entries of a specified kind. */
export const fetchReferences = (
  kind: EntryKind,
  options: { q?: string; cursor?: string; limit?: number; ids?: string[] } = {},
) =>
  makeJSONRequest<ReadPage<EntityReference>>({
    url: `${address}/${kind}/references?${params({ ...options, ids: options.ids?.join(',') })}`,
    method: 'GET',
  })

/** Retrieves the complete set of references for a given entry kind. */
export async function fetchAllReferences(kind: EntryKind) {
  const items: EntityReference[] = []
  let cursor: string | undefined
  do {
    const page = await fetchReferences(kind, { cursor, limit: 100 })
    items.push(...page.items)
    cursor = page.nextCursor ?? undefined
  } while (cursor)
  return items
}

/** Supporter aliases retain their existing HTTP paths. */
export const fetchSupporterItems = (kind: 'tags' | 'urls', id: string) =>
  makeJSONRequest<ContainerDetail>({
    url: apiAddress(`${kind}/${encodeURIComponent(id)}/items`),
    method: 'GET',
  })
