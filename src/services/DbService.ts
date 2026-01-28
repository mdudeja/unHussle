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

  fetchAll() {
    return makeJSONRequest<T['Read'][]>({
      url: `${this.dbUrl}/${this.baseEndpoint}`,
      method: 'GET',
    })
  }

  fetchById(id: string) {
    return makeJSONRequest<T['Read']>({
      url: `${this.dbUrl}/${this.baseEndpoint}/${id}`,
      method: 'GET',
    })
  }

  create(data: T['Write']) {
    return makeJSONRequest<T['Read']>({
      url: `${this.dbUrl}/${this.baseEndpoint}`,
      method: 'POST',
      body: data,
    })
  }

  update(id: string, data: T['Update']) {
    return makeJSONRequest<T['Read']>({
      url: `${this.dbUrl}/${this.baseEndpoint}/${id}`,
      method: 'PATCH',
      body: data,
    })
  }

  delete(id: string) {
    return makeJSONRequest<T['Read']>({
      url: `${this.dbUrl}/${this.baseEndpoint}/${id}`,
      method: 'DELETE',
    })
  }
}
