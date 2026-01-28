import { useDatabaseStatus } from '@/hooks/useDatabaseStatus'
import { TaskTimer } from '@/components/tasks/TaskTimer'
import { TaskForm } from '@/components/tasks/TaskForm'
import '@/styles/App.css'

function App() {
  const { isReady, error } = useDatabaseStatus()

  return (
    <main className="min-h-screen bg-default-bg text-text font-body p-4">
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

      {/* Task Management */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold border-b border-border pb-2">
          Task Management
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="font-medium text-muted">Task Timer</h3>
            <div className="p-4 border border-border rounded-xl bg-surface flex items-center justify-between">
              <span>Task: Implement Timer</span>
              <TaskTimer taskId="demo-task-123" initialSpentMinutes={15} />
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-muted">Task Form</h3>
            <div className="p-4 border border-border rounded-xl bg-surface">
              <TaskForm
                onCancel={() => console.log('Cancel')}
                onSubmit={async (data) => {
                  console.log('Submit', data)
                  await new Promise((r) => setTimeout(r, 1000))
                }}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default App
