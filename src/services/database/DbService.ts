import { makeJSONRequest } from '@/lib/server'
import { DbEntityTypes, WithSupporters } from '@c/types/index'

/** Options for writes; `operationId` correlates the write with its backend events. */
export type MutationOptions = { operationId?: string }

const mutationHeaders = ({ operationId }: MutationOptions = {}) =>
  operationId ? { 'x-operation-id': operationId } : undefined

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
