import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useStore } from '@/store'
import type { OvernightPrompt } from '@/store/slices/createUISlice'
import { useWorkflowQuery, useWorkflowRuntime } from '@/workflows/hooks'
import { suggestedStop } from '@/workflows/schedulerHooks'
import { cancelTask, completeTask, pauseTask } from '@/workflows/taskCommands'
import { getTimeZoneId } from '@c/datetimeUtils'
import { Logger } from '@c/Logger'
import { OvernightCheck } from './OvernightCheck'

const actions = {
  pause: pauseTask,
  complete: completeTask,
  cancel: cancelTask,
} satisfies Record<OvernightPrompt['then'], (id: string) => Promise<void>>

/**
 * The app-wide "did you stop at some point?" dialog for task actions outside
 * the home card. Opened through `useStore.getState().askOvernight(...)`.
 */
export const OvernightDialogHost = () => {
  const prompt = useStore((state) => state.overnightPrompt)
  if (!prompt) return null
  // Remount per prompt so the picked time and errors don't carry over.
  return (
    <OvernightDialog
      key={`${prompt.taskId}:${prompt.startedAt}:${prompt.then}`}
      prompt={prompt}
    />
  )
}

const OvernightDialog = ({ prompt }: { prompt: OvernightPrompt }) => {
  const close = useStore((state) => state.closeOvernight)
  const runtime = useWorkflowRuntime()
  const settings = useWorkflowQuery({
    key: 'schedule:settings',
    dependencies: ['schedulerSettings'],
    load: () => runtime.scheduler.settings(),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timezone = getTimeZoneId()

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await work()
      close()
    } catch (err) {
      Logger.getInstance().error('Overnight answer failed', { error: err })
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Still working on this?</DialogTitle>
          <DialogDescription>
            Only the time you worked is counted.
          </DialogDescription>
        </DialogHeader>
        {settings.data || settings.error ? (
          <OvernightCheck
            startedAt={prompt.startedAt}
            suggestedStop={
              settings.data
                ? suggestedStop(prompt.startedAt, timezone, settings.data)
                : prompt.startedAt
            }
            busy={busy}
            stillWorkingLabel="I worked the whole time"
            onStillWorking={() =>
              run(() => actions[prompt.then](prompt.taskId))
            }
            onStopped={(at) =>
              run(async () => {
                // Stopping the interval already pauses the task.
                await runtime.commands.execute('scheduler.tracking.stop', {
                  taskId: prompt.taskId,
                  occurrenceId: null,
                  at,
                })
                if (prompt.then !== 'pause')
                  await actions[prompt.then](prompt.taskId)
              })
            }
          />
        ) : (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
