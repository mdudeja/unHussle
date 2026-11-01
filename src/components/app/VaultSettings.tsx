import { useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { FolderInput, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useVaultInfo, useWorkflowRuntime } from '@/workflows/hooks'
import { useSchedulerAction } from '@/workflows/schedulerHooks'

/** Where resource files live, moving them, and picking up files added outside the app. */
export function VaultSettings() {
  const runtime = useWorkflowRuntime()
  const info = useVaultInfo()
  const action = useSchedulerAction()
  const [summary, setSummary] = useState<string | null>(null)

  const rescan = () =>
    action.run(async () => {
      const result = await runtime.commands.execute('vault.rescan', {})
      const parts = [
        `${result.imported} imported`,
        `${result.repaired} repaired`,
      ]
      if (result.missing.length)
        parts.push(`still missing: ${result.missing.join(', ')}`)
      setSummary(parts.join(' · '))
    })

  const move = () =>
    action.run(async () => {
      const picked = await open({ directory: true, multiple: false })
      if (typeof picked !== 'string') return
      await runtime.commands.execute('vault.settings.change', { path: picked })
      setSummary('Vault moved.')
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resource vault</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {info.error && <p role="alert">{info.error}</p>}
        {info.data && (
          <>
            <p className="break-all">
              <span className="text-muted-foreground">Folder: </span>
              {info.data.path}
              {info.data.source === 'default' && (
                <span className="text-muted-foreground"> (default)</span>
              )}
            </p>
            <p className="text-muted-foreground">
              {info.data.resources} resources
              {info.data.missing > 0 && `, ${info.data.missing} missing a file`}
            </p>
          </>
        )}
        <p className="text-muted-foreground">
          Files are plain markdown, so you can edit them in other apps too.
          Rescan to add files you put in the folder yourself.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={action.busy} onClick={rescan}>
            <RefreshCw className="size-4" />
            Rescan vault
          </Button>
          {isTauri() && (
            <Button variant="outline" disabled={action.busy} onClick={move}>
              <FolderInput className="size-4" />
              Move to another folder…
            </Button>
          )}
        </div>
        {action.error && (
          <p role="alert" className="text-destructive">
            {action.error}
          </p>
        )}
        {summary && !action.error && <p>{summary}</p>}
      </CardContent>
    </Card>
  )
}
