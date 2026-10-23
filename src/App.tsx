import '@/styles/App.css'
import { Outlet } from 'react-router'
import { useStore } from '@/store'
import { useEffect } from 'react'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { AppSidebarComponent, EntityEditDialogHost } from '@/components/app'

function App() {
  const { isDBReady, checkDBReady, dbError } = useStore()

  useEffect(() => {
    if (isDBReady) {
      return
    }
    checkDBReady()
  }, [isDBReady])

  return (
    <SidebarProvider>
      <AppSidebarComponent />
      <SidebarInset className="min-h-screen bg-default-bg text-text font-body p-4 flex flex-col">
        <SidebarTrigger />
        {/* Database Status Indicator (Top Right) */}
        <div className="fixed top-4 right-4 z-50">
          {dbError ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger/10 text-danger border border-danger/20">
              DB Disconnected
            </span>
          ) : isDBReady ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-sage/10 text-sage border border-sage/20">
              DB Connected
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
              Connecting...
            </span>
          )}
        </div>

        <Outlet />
        <EntityEditDialogHost />
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
