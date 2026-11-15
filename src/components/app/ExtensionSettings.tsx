import { useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { FolderInput, RefreshCw } from 'lucide-react'
import type { InstalledExtension } from '@c/extensions/manifest'
import {
  dependentsOf,
  requirementsOf,
  type DependencyNode,
} from '@c/extensions/dependencies'
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
/** Turning one on or off, with the others that change with it. */
type Change = { manifest: Manifest; with: Manifest[] }

const names = (manifests: Manifest[]) =>
  manifests.map(({ name }) => name).join(', ')

/** The extensions folder, and turning each extension in it on or off. */
export function ExtensionSettings() {
  const runtime = useWorkflowRuntime()
  const list = useInstalledExtensions()
  const loadErrors = useExtensionLoadErrors()
  const action = useSchedulerAction()
  const [enabling, setEnabling] = useState<Change | null>(null)
  const [disabling, setDisabling] = useState<Change | null>(null)

  const installed = list.data?.extensions ?? []
  const manifests = installed.flatMap(({ manifest }) => manifest ?? [])
  const nodes: DependencyNode[] = manifests
  const byId = (ids: string[]) =>
    ids.flatMap((id) => manifests.find((manifest) => manifest.id === id) ?? [])
  const enabledIds = new Set(
    installed.filter((e) => e.enabled).map((e) => e.manifest?.id),
  )
  const offRequirements = (id: string) =>
    byId(requirementsOf(nodes, id).filter((other) => !enabledIds.has(other)))
  const onDependents = (id: string) =>
    byId(dependentsOf(nodes, id).filter((other) => enabledIds.has(other)))

  const refresh = () => runtime.queries.invalidate(['extensions'])
  // Reloading code from disk: drop loaded frontend entries first.
  const reload = async (work: () => Promise<unknown>) => {
    await work()
    runtime.extensionLoader.reset()
    await refresh()
  }

  // What an extension needs goes on first; the server turns dependents off.
  const apply = ({ manifest, with: others }: Change, enabled: boolean) =>
    action.run(async () => {
      try {
        for (const { id } of enabled ? [...others, manifest] : [manifest])
          await extensionService.setEnabled(id, enabled)
      } finally {
        await refresh()
      }
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
                    key={`${extension.bundled}:${extension.folder}`}
                    extension={extension}
                    loadError={
                      extension.manifest && loadErrors[extension.manifest.id]
                    }
                    needs={byId(extension.manifest?.requires ?? [])}
                    usedBy={byId(
                      manifests
                        .filter((m) =>
                          m.requires?.includes(extension.manifest?.id ?? ''),
                        )
                        .map((m) => m.id),
                    )}
                    busy={action.busy}
                    onEnable={(manifest) =>
                      setEnabling({
                        manifest,
                        with: offRequirements(manifest.id),
                      })
                    }
                    onDisable={(manifest) => {
                      const change = {
                        manifest,
                        with: onDependents(manifest.id),
                      }
                      if (change.with.length) setDisabling(change)
                      else void apply(change, false)
                    }}
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
        open={enabling !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEnabling(null)
        }}
      >
        {enabling && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Turn on {enabling.manifest.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {enabling.with.length > 0 &&
                  `It needs ${names(enabling.with)}, so that turns on too. `}
                Extensions can read and change all your data. Only turn on
                extensions you trust.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <Button
                type="button"
                onClick={() => {
                  void apply(enabling, true)
                  setEnabling(null)
                }}
              >
                {enabling.with.length ? 'Turn on all' : 'Turn on'}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
      <AlertDialog
        open={disabling !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDisabling(null)
        }}
      >
        {disabling && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Turn off {disabling.manifest.name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Also turns off {names(disabling.with)}, because{' '}
                {disabling.with.length > 1 ? 'they need' : 'it needs'} it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  void apply(disabling, false)
                  setDisabling(null)
                }}
              >
                Turn off all
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
  needs,
  usedBy,
  busy,
  onEnable,
  onDisable,
}: {
  extension: InstalledExtension
  loadError?: string
  needs: Manifest[]
  usedBy: Manifest[]
  busy: boolean
  onEnable: (manifest: Manifest) => void
  onDisable: (manifest: Manifest) => void
}) {
  const { manifest } = extension
  const invalid = extension.status === 'invalid'
  const error = invalid
    ? `Can't turn on: ${extension.error}. Fix the extension, then rescan.`
    : extension.status === 'failed'
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
          <span className="text-muted-foreground">
            {manifest.version}
            {extension.bundled && ' · Built in'}
          </span>
        </p>
        {manifest.description && (
          <p className="text-muted-foreground">{manifest.description}</p>
        )}
        {needs.length > 0 && (
          <p className="text-muted-foreground">Needs: {names(needs)}</p>
        )}
        {usedBy.length > 0 && (
          <p className="text-muted-foreground">Used by: {names(usedBy)}</p>
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
        disabled={busy || (invalid && !extension.enabled)}
        onCheckedChange={(checked) =>
          checked ? onEnable(manifest) : onDisable(manifest)
        }
      />
    </li>
  )
}
