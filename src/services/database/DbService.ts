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

export class DbService<T extends DbEntityTypes> {
  dbUrl: string
  baseEndpoint: string

  constructor(baseEndpoint: string) {
    this.dbUrl = `http://localhost:${import.meta.env.VITE_DB_SERVER_PORT}`
    this.baseEndpoint = baseEndpoint
  }

  async fetchPaginated(page: number, pageSize: number) {
    const pageNum = page > 0 ? page : 1
    const pageSizeNum = pageSize > 0 ? pageSize : 10

    return makeJSONRequest<T['Read'][]>({
      url: `${this.dbUrl}/${this.baseEndpoint}/paginated/${pageNum}/${pageSizeNum}`,
      method: 'GET',
    })
  }

  async fetchAll() {
    return makeJSONRequest<T['Read'][]>({
      url: `${this.dbUrl}/${this.baseEndpoint}`,
      method: 'GET',
    })
  }

  async search(query: string) {
    return makeJSONRequest<T['Read'][]>({
      url: `${this.dbUrl}/${this.baseEndpoint}/search/${encodeURIComponent(query)}`,
      method: 'GET',
    })
  }

  async fetchById(id: string) {
    return makeJSONRequest<T['Read']>({
      url: `${this.dbUrl}/${this.baseEndpoint}/${id}`,
      method: 'GET',
    })
  }

  async create(data: WithSupporters<T['Write']>, options?: MutationOptions) {
    return makeJSONRequest<T['Read']>({
      url: `${this.dbUrl}/${this.baseEndpoint}`,
      method: 'POST',
      body: data,
      headers: mutationHeaders(options),
    })
  }

  async update(
    id: string,
    data: WithSupporters<T['Update']>,
    options?: MutationOptions,
  ) {
    return makeJSONRequest<T['Read']>({
      url: `${this.dbUrl}/${this.baseEndpoint}/${id}`,
      method: 'PATCH',
      body: data,
      headers: mutationHeaders(options),
    })
  }

  async delete(id: string, options?: MutationOptions) {
    return makeJSONRequest<T['Read']>({
      url: `${this.dbUrl}/${this.baseEndpoint}/${id}`,
      method: 'DELETE',
      headers: mutationHeaders(options),
    })
  }

  async reset(options?: MutationOptions) {
    return makeJSONRequest<{ deleted: number }>({
      url: `${this.dbUrl}/${this.baseEndpoint}/all`,
      method: 'DELETE',
      headers: mutationHeaders(options),
    })
  }
}
