import { DatabaseContext } from '@/contexts/DatabaseContext'
import { useContext } from 'react'

export function useDatabaseStatus() {
  const context = useContext(DatabaseContext)

  if (context === undefined) {
    throw new Error('useDatabaseStatus must be used within a DatabaseProvider')
  }

  return {
    isReady: context.isReady,
    error: context.error,
  }
}
