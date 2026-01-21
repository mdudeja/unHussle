import { createContext, useEffect, useState, ReactNode } from 'react'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import * as schema from '@/services/database/schemas'
import { DatabaseAdapter } from '@/services/database/DatabaseAdapter'

type DatabaseContextType = {
  db: BunSQLiteDatabase<typeof schema> | null
  adapter: DatabaseAdapter | null
  isReady: boolean
  error: string | null
}

export const DatabaseContext = createContext<DatabaseContextType | undefined>(
  undefined,
)

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<BunSQLiteDatabase<typeof schema> | null>(null)
  const [adapter, setAdapter] = useState<DatabaseAdapter | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function initializeDatabase() {
      try {
        console.log('Initializing database...')
        const dbAdapter = new DatabaseAdapter()
        await dbAdapter.initialize()

        setAdapter(dbAdapter)
        
        // Only set db if not in server mode
        if (!dbAdapter.isServerMode()) {
          setDb(dbAdapter.getDb())
        }

        console.log('Database ready!')
        setIsReady(true)
      } catch (err) {
        console.error('Database initialization failed:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    initializeDatabase()
  }, [])

  return (
    <DatabaseContext.Provider value={{ db, adapter, isReady, error }}>
      {children}
    </DatabaseContext.Provider>
  )
}
