import { makeJSONRequest } from '@/lib/server'
import { InferTableTypes } from '@c/index'
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

  async fetchAll() {
    return makeJSONRequest<T['Read'][]>({
      url: `${this.dbUrl}/${this.baseEndpoint}`,
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
