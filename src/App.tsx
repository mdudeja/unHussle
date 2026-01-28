import { useDatabaseStatus } from '@/hooks/useDatabaseStatus'
import { HomeView } from '@/components/home/HomeView'
import '@/styles/App.css'
import { useStore } from '@/store'
import { useEffect } from 'react'

function App() {
  const { isReady, error } = useDatabaseStatus()
  const { tasks } = useStore()

  useEffect(() => {
    if (!isReady) {
      return
    }

    tasks.fetch()
  }, [isReady])

  return (
    <main className="min-h-screen bg-default-bg text-text font-body p-4 flex flex-col">
      {/* Database Status Indicator (Top Right) */}
      <div className="fixed top-4 right-4 z-50">
        {error ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger border border-danger/20">
            DB Disconnected
          </span>
        ) : isReady ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sage/10 text-sage border border-sage/20">
            DB Connected
          </span>
        ) : (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
            Connecting...
          </span>
        )}
      </div>

      <HomeView />
    </main>
  )
}

export default App
