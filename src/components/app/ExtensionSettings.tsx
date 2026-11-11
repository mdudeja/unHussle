import { useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { FolderInput, RefreshCw } from 'lucide-react'
import type { InstalledExtension } from '@c/extensions/manifest'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  useExtensionLoadErrors,
  useInstalledExtensions,
} from '@/extensions/hooks'
import { extensionService } from '@/services/extensions'
import { useWorkflowRuntime } from '@/workflows/hooks'
import { useSchedulerAction } from '@/workflows/schedulerHooks'

type Manifest = NonNullable<InstalledExtension['manifest']>

/** The extensions folder, and turning each extension in it on or off. */
export function ExtensionSettings() {
  const runtime = useWorkflowRuntime()
  const list = useInstalledExtensions()
  const loadErrors = useExtensionLoadErrors()
  const action = useSchedulerAction()
  const [confirming, setConfirming] = useState<Manifest | null>(null)

  const refresh = () => runtime.queries.invalidate(['extensions'])
  // Reloading code from disk: drop loaded frontend entries first.
  const reload = async (work: () => Promise<unknown>) => {
    await work()
    runtime.extensionLoader.reset()
    await refresh()
  }

  const setEnabled = (id: string, enabled: boolean) =>
    action.run(async () => {
      await extensionService.setEnabled(id, enabled)
      await refresh()
    })

  const move = () =>
    action.run(async () => {
      const picked = await open({ directory: true, multiple: false })
      if (typeof picked !== 'string') return
      await reload(() => extensionService.setDirectory(picked))
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extensions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {list.error && <p role="alert">{list.error}</p>}
        {!list.data && !list.error && <p>Loading extensions…</p>}
        {list.data && (
          <>
            <p className="break-all">
              <span className="text-muted-foreground">Folder: </span>
              {list.data.directory}
            </p>
            {list.data.extensions.length ? (
              <ul className="space-y-3">
                {list.data.extensions.map((extension) => (
                  <ExtensionItem
                    key={extension.folder}
                    extension={extension}
                    loadError={
                      extension.manifest && loadErrors[extension.manifest.id]
                    }
                    busy={action.busy}
                    onEnable={setConfirming}
                    onDisable={(id) => setEnabled(id, false)}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">
                No extensions found. Add a folder containing an extension.json
                file, then rescan.
              </p>
            )}
          </>
        )}
        <p className="text-muted-foreground">
          Each extension is a folder with an extension.json file. Rescan after
          adding or editing one.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={action.busy}
            onClick={() =>
              action.run(() => reload(() => extensionService.rescan()))
            }
          >
            <RefreshCw className="size-4" />
            Rescan extensions
          </Button>
          {isTauri() && (
            <Button variant="outline" disabled={action.busy} onClick={move}>
              <FolderInput className="size-4" />
              Choose another folder…
            </Button>
          )}
        </div>
        {action.error && (
          <p role="alert" className="text-destructive">
            {action.error}
          </p>
        )}
      </CardContent>
      <AlertDialog
        open={confirming !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setConfirming(null)
        }}
      >
        {confirming && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Turn on {confirming.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                Extensions can read and change all your data. Only turn on
                extensions you trust.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <Button
                type="button"
                onClick={() => {
                  void setEnabled(confirming.id, true)
                  setConfirming(null)
                }}
              >
                Turn on
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </Card>
  )
}

function ExtensionItem({
  extension,
  loadError,
  busy,
  onEnable,
  onDisable,
}: {
  extension: InstalledExtension
  loadError?: string
  busy: boolean
  onEnable: (manifest: Manifest) => void
  onDisable: (id: string) => void
}) {
  const { manifest } = extension
  const error =
    extension.status === 'failed'
      ? `Could not start: ${extension.error}. Fix the extension, then rescan.`
      : loadError &&
        `Could not load: ${loadError}. Fix the extension, then rescan.`
  if (!manifest)
    return (
      <li>
        <p className="font-medium">{extension.folder}</p>
        <p role="alert" className="text-destructive">
          Not a valid extension: {extension.error}
        </p>
      </li>
    )
  return (
    <li className="flex items-start justify-between gap-4">
      <div>
        <p className="font-medium">
          {manifest.name}{' '}
          <span className="text-muted-foreground">{manifest.version}</span>
        </p>
        {manifest.description && (
          <p className="text-muted-foreground">{manifest.description}</p>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
      <Switch
        aria-label={`Turn ${manifest.name} on or off`}
        checked={extension.enabled}
        disabled={busy}
        onCheckedChange={(checked) =>
          checked ? onEnable(manifest) : onDisable(manifest.id)
        }
      />
    </li>
  )
}
