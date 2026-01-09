import { IDatabaseAdapter } from './adapters/IDatabaseAdapter'
import { TauriSqlAdapter } from './adapters/TauriSqlAdapter'

// Singleton instance
let adapterInstance: IDatabaseAdapter | null = null
let adapterFactory: () => IDatabaseAdapter = () => new TauriSqlAdapter()

// Method to override factory (used by tests)
export const setAdapterFactory = (factory: () => IDatabaseAdapter) => {
  adapterFactory = factory
  adapterInstance = null // Reset instance
}

export const getDb = async (): Promise<IDatabaseAdapter> => {
  if (adapterInstance) return adapterInstance
  adapterInstance = adapterFactory()
  return adapterInstance
}

// Generic CRUD helpers
export const execute = async (
  query: string,
  bindValues?: unknown[],
): Promise<any> => {
  const db = await getDb()
  return await db.execute(query, bindValues)
}

export const select = async <T>(
  query: string,
  bindValues?: unknown[],
): Promise<T[]> => {
  const db = await getDb()
  return await db.select<T>(query, bindValues)
}

export const close = async () => {
  if (adapterInstance) {
    await adapterInstance.close()
    adapterInstance = null
  }
}
