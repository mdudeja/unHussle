import { makeJSONRequest } from '@/lib/server'
import { InferTableTypes } from '@c/types/index'
import { SQLiteTableWithColumns } from 'drizzle-orm/sqlite-core'

export class DbService<
  T extends InferTableTypes<unknown, SQLiteTableWithColumns<any>>,
> {
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

  async create(data: T['Write']) {
    return makeJSONRequest<T['Read']>({
      url: `${this.dbUrl}/${this.baseEndpoint}`,
      method: 'POST',
      body: data,
    })
  }

  async update(id: string, data: T['Update']) {
    return makeJSONRequest<T['Read']>({
      url: `${this.dbUrl}/${this.baseEndpoint}/${id}`,
      method: 'PATCH',
      body: data,
    })
  }

  async delete(id: string) {
    return makeJSONRequest<T['Read']>({
      url: `${this.dbUrl}/${this.baseEndpoint}/${id}`,
      method: 'DELETE',
    })
  }

  async reset() {
    return makeJSONRequest<void>({
      url: `${this.dbUrl}/${this.baseEndpoint}/all`,
      method: 'DELETE',
    })
  }
}
