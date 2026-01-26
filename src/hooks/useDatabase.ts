import { DatabaseContext } from '@/contexts/DatabaseContext'
import { useContext } from 'react'

export function useDatabase() {
  const context = useContext(DatabaseContext)

  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider')
  }

  if (!context.isReady) {
    throw new Error('Database is not ready yet')
  }

  if (context.error) {
    throw new Error(`Database error: ${context.error}`)
  }

  return context.adapter!
}
