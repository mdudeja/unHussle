import { createContext, useEffect, useState, ReactNode } from 'react'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import * as schema from '@/services/database/schemas'
import { UnHussleDB } from '@/services/database/UnHussleDB'
import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

type DatabaseContextType = {
  db: BunSQLiteDatabase<typeof schema> | null
  isReady: boolean
  error: string | null
}

export const DatabaseContext = createContext<DatabaseContextType | undefined>(
  undefined,
)

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<BunSQLiteDatabase<typeof schema> | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function initializeDatabase() {
      try {
        console.log('Initializing database...')
        const database = await UnHussleDB.getInstance().getDb()

        console.log('Running database migrations...')
        await migrate(database, { migrationsFolder: './drizzle_migrations' })

        console.log('Database ready!')
        setDb(database)
        setIsReady(true)
      } catch (err) {
        console.error('Database initialization failed:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      }
    }

    initializeDatabase()
  }, [])

  return (
    <DatabaseContext.Provider value={{ db, isReady, error }}>
      {children}
    </DatabaseContext.Provider>
  )
}
