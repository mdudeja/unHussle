import { makeJSONRequest } from '@/lib/server'
import type { EntryKind } from '@c/workflows/contracts'
import type {
  ContainerDetail,
  EntityReference,
  ReadContainerKind,
  ReadPage,
  TaskPageOptions,
} from '@c/types/readModels'

const address = `http://localhost:${import.meta.env.VITE_DB_SERVER_PORT || 3456}`

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
