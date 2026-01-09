import Database from '@tauri-apps/plugin-sql'

let dbInstance: Database | null = null

export const getDb = async (): Promise<Database> => {
  if (dbInstance) {
    return dbInstance
  }

  dbInstance = await Database.load('sqlite:unhussle.db')
  return dbInstance
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
  return await db.select<T[]>(query, bindValues)
}

export const close = async () => {
  if (dbInstance) {
    await dbInstance.close()
    dbInstance = null
  }
}
