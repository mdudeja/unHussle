import { createContext, useEffect, useState, ReactNode } from 'react'
import { DatabaseAdapter } from '@/services/database/DatabaseAdapter'

type DatabaseContextType = {
  adapter: DatabaseAdapter | null
  isReady: boolean
  error: string | null
}

export const DatabaseContext = createContext<DatabaseContextType | undefined>(
  undefined,
)

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [adapter, setAdapter] = useState<DatabaseAdapter | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function initializeDatabase() {
      try {
        const dbAdapter = new DatabaseAdapter()
        await dbAdapter.initialize()

        setAdapter(dbAdapter)
        setIsReady(dbAdapter ? dbAdapter.getReadyStatus() : false)
      } catch (err) {
        console.error('Database initialization failed:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    initializeDatabase()
  }, [])

  return (
    <DatabaseContext.Provider value={{ adapter, isReady, error }}>
      {children}
    </DatabaseContext.Provider>
  )
}
