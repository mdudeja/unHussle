import { WorkflowWarnings } from '@/components/app/WorkflowWarnings'
import '@/styles/App.css'
import { Outlet } from 'react-router'
import { useStore } from '@/store'
import { useEffect } from 'react'
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  AppSidebarComponent,
  EntityEditDialogHost,
  OvernightDialogHost,
} from '@/components/app'
import { Logger } from '@c/Logger'
import { WorkflowInspector } from '@/components/dev/WorkflowInspector'
import { useExtensionActivation } from '@/extensions/hooks'

function App() {
  const { isDBReady, checkDBReady, dbError } = useStore()
  useExtensionActivation()

  useEffect(() => {
    if (isDBReady) {
      return
    }
    checkDBReady().catch((err) =>
      Logger.getInstance().error('DB readiness check failed', { error: err }),
    )
  }, [isDBReady, checkDBReady])

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebarComponent />
        <SidebarInset className="min-h-screen bg-default-bg text-text font-body p-4 flex flex-col">
          <SidebarTrigger />
          {/* Database Status Indicator (Top Right) */}
          <div className="fixed top-4 right-4 z-50">
            {dbError ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">
                System not ready.
              </span>
            ) : isDBReady ? null : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning-foreground border border-warning/20">
                Connecting...
              </span>
            )}
          </div>

          <WorkflowWarnings />
          <Outlet />
          <EntityEditDialogHost />
          <OvernightDialogHost />
          {import.meta.env.DEV && <WorkflowInspector />}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

export default App
