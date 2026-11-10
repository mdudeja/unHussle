import { apiAddress } from '@/lib/apiAddress'
import { makeJSONRequest } from '@/lib/server'
import { DbEntityTypes, WithSupporters } from '@c/types/index'
import { parentSpanHeader, traceIdHeader } from '@c/workflows/telemetry'

/**
 * Options for writes. `operationId` correlates the write with its backend
 * events; `traceId` / `parentSpanId` join the backend spans to the caller's trace.
 */
export type MutationOptions = {
  operationId?: string
  traceId?: string
  parentSpanId?: string
}

/** Generates optional tracing and operation identification headers for a mutation request based on the provided identifiers. */
export const mutationHeaders = ({
  operationId,
  traceId,
  parentSpanId,
}: MutationOptions = {}) => {
  const headers: Record<string, string> = {}
  if (operationId) headers['x-operation-id'] = operationId
  if (traceId) headers[traceIdHeader] = traceId
  if (parentSpanId) headers[parentSpanHeader] = parentSpanId
  return Object.keys(headers).length ? headers : undefined
}

/** Provides client-side access to a typed database endpoint for retrieving, searching, creating, updating, and deleting records. */
export function createDbService<
  T extends DbEntityTypes,
  Read extends T['Read'] = T['Read'],
>(baseEndpoint: string) {
  const endpoint = apiAddress(baseEndpoint)
  return {
    /** Fetches a paginated collection of records. */
    async fetchPaginated(page: number, pageSize: number) {
      const pageNum = page > 0 ? page : 1
      const pageSizeNum = pageSize > 0 ? pageSize : 10

      return makeJSONRequest<Read[]>({
        url: `${endpoint}/paginated/${pageNum}/${pageSizeNum}`,
        method: 'GET',
      })
    },

    /** Fetches all records from the configured endpoint. */
    async fetchAll() {
      return makeJSONRequest<Read[]>({
        url: `${endpoint}`,
        method: 'GET',
      })
    },

    /** Searches for records matching the specified query. */
    async search(query: string) {
      return makeJSONRequest<Read[]>({
        url: `${endpoint}/search/${encodeURIComponent(query)}`,
        method: 'GET',
      })
    },

    /** Fetches a single record identified by its ID. */
    async fetchById(id: string) {
      return makeJSONRequest<Read>({
        url: `${endpoint}/${id}`,
        method: 'GET',
      })
    },

    /** Creates a new record in the database. */
    async create(data: WithSupporters<T['Write']>, options?: MutationOptions) {
      return makeJSONRequest<Read>({
        url: `${endpoint}`,
        method: 'POST',
        body: data,
        headers: mutationHeaders(options),
      })
    },

    /** Update an existing record and return its updated representation. */
    async update(
      id: string,
      data: WithSupporters<T['Update']>,
      options?: MutationOptions,
    ) {
      return makeJSONRequest<Read>({
        url: `${endpoint}/${id}`,
        method: 'PATCH',
        body: data,
        headers: mutationHeaders(options),
      })
    },

    /** Deletes the specified resource from the database. */
    async delete(id: string, options?: MutationOptions) {
      return makeJSONRequest<Read>({
        url: `${endpoint}/${id}`,
        method: 'DELETE',
        headers: mutationHeaders(options),
      })
    },

    /** Deletes all existing data, resetting the database to an empty state. */
    async reset(options?: MutationOptions) {
      return makeJSONRequest<{ deleted: number }>({
        url: `${endpoint}/all`,
        method: 'DELETE',
        headers: mutationHeaders(options),
      })
    },
  }
}
