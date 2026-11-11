import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { Value } from '@sinclair/typebox/value'
import type { Logger } from '@c/Logger'
import type { Disposable } from '@c/extensions/sdk'
import {
  extensionManifestSchema,
  type ExtensionList,
  type ExtensionManifest,
  type InstalledExtension,
} from '@c/extensions/manifest'
import type { BackendExtension } from '@d/extensions/sdk'
import type { UnHussleDB } from '@d/database/UnHussleDB'
import type { createBackendExtensions } from '@d/extensions/application'
import { bundleEntry } from '@d/extensions/bundle'
import { readAppSettings, updateAppSettings } from '@d/extensions/settings'

const MANIFEST_FILE = 'extension.json'

/** A problem the user can fix; its message is shown as is. */
export class ExtensionError extends Error {}

export function defaultExtensionsRoot(dbFilePath?: string) {
  if (process.env.EXTENSIONS_DIR) return process.env.EXTENSIONS_DIR
  if (!dbFilePath || dbFilePath === ':memory:')
    return mkdtempSync(join(tmpdir(), 'unhussle-extensions-'))
  return join(dirname(dbFilePath), 'extensions')
}

const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/** An entry path that stays inside its extension folder. */
function entryPath(folder: string, relative: string) {
  const root = resolve(folder)
  const path = resolve(root, relative)
  if (!path.startsWith(root + sep))
    throw new Error(`Entry must be inside the extension folder: ${relative}`)
  return path
}

async function readManifest(folder: string): Promise<ExtensionManifest> {
  const file = join(folder, MANIFEST_FILE)
  if (!existsSync(file)) throw new Error(`Missing ${MANIFEST_FILE}`)
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    throw new Error(`${MANIFEST_FILE} is not valid JSON: ${message(error)}`, {
      cause: error,
    })
  }
  const issue = Value.Errors(extensionManifestSchema, parsed).First()
  if (issue)
    throw new Error(
      `${MANIFEST_FILE}: ${issue.path || 'root'} ${issue.message.toLowerCase()}`,
    )
  return parsed as ExtensionManifest
}

type Entry = InstalledExtension & { path: string }

/** Discovers extension folders and activates the ones the user enabled. */
export function createExtensionManager(
  database: UnHussleDB,
  host: ReturnType<typeof createBackendExtensions>,
  logger: Logger,
) {
  const active = new Map<string, Disposable>()
  const frontendBundles = new Map<string, Promise<string>>()
  let defaultRoot: string | undefined
  let bundleDir: string | undefined
  let directory = ''
  let entries: Entry[] = []

  const find = (id: string) => {
    const entry = entries.find((entry) => entry.manifest?.id === id)
    if (!entry) throw new ExtensionError(`No extension with ID "${id}"`)
    return entry
  }

  const deactivate = (entry: Entry) => {
    const id = entry.manifest?.id
    if (!id) return
    active.get(id)?.()
    active.delete(id)
    frontendBundles.delete(id)
  }

  const activate = async (entry: Entry) => {
    const manifest = entry.manifest!
    try {
      if (manifest.backend) {
        bundleDir ??= mkdtempSync(join(tmpdir(), 'unhussle-extension-bundles-'))
        const file = join(bundleDir, `${manifest.id}-${Date.now()}.js`)
        await Bun.write(
          file,
          await bundleEntry(entryPath(entry.path, manifest.backend), 'backend'),
        )
        let extension: BackendExtension | undefined
        try {
          extension = ((await import(file)) as { default?: BackendExtension })
            .default
        } finally {
          rmSync(file, { force: true })
        }
        if (typeof extension?.activate !== 'function')
          throw new Error(
            `${manifest.backend} must default-export { activate }`,
          )
        active.set(manifest.id, host.register(manifest.id, extension))
      }
      entry.status = 'active'
      entry.error = undefined
    } catch (error) {
      entry.status = 'failed'
      entry.error = message(error)
      logger.error(`Extension ${manifest.id} failed to activate`, { error })
    }
  }

  const scan = async (enabled: string[]) => {
    mkdirSync(directory, { recursive: true })
    const seen = new Map<string, string>()
    const next: Entry[] = []
    const folders = readdirSync(directory, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
      .sort()
    for (const folder of folders) {
      const path = join(directory, folder)
      try {
        const manifest = await readManifest(path)
        const other = seen.get(manifest.id)
        if (other)
          throw new Error(`ID "${manifest.id}" is already used by ${other}`)
        seen.set(manifest.id, folder)
        next.push({
          folder,
          path,
          manifest,
          enabled: enabled.includes(manifest.id),
          status: 'disabled',
        })
      } catch (error) {
        next.push({
          folder,
          path,
          enabled: false,
          status: 'invalid',
          error: message(error),
        })
      }
    }
    return next
  }

  const list = (): ExtensionList => ({
    directory,
    extensions: entries.map(({ path: _path, ...entry }) => entry),
  })

  /** Reloads every extension from disk, picking up code and manifest edits. */
  const rescan = async () => {
    for (const entry of entries) deactivate(entry)
    const settings = await readAppSettings(database)
    defaultRoot ??= defaultExtensionsRoot(database.filePath)
    directory = settings.extensionsDir ?? defaultRoot
    entries = await scan(settings.enabledExtensions ?? [])
    for (const entry of entries) if (entry.enabled) await activate(entry)
    return list()
  }

  return {
    list,
    rescan,
    setEnabled: async (id: string, enabled: boolean) => {
      const entry = find(id)
      await updateAppSettings(database, (settings) => {
        const others = (settings.enabledExtensions ?? []).filter(
          (value) => value !== id,
        )
        return {
          ...settings,
          enabledExtensions: enabled ? [...others, id] : others,
        }
      })
      entry.enabled = enabled
      deactivate(entry)
      if (enabled) await activate(entry)
      else {
        entry.status = 'disabled'
        entry.error = undefined
      }
      return list()
    },
    setDirectory: async (path: string) => {
      if (!isAbsolute(path))
        throw new ExtensionError(
          'Choose a full folder path, such as /home/me/extensions',
        )
      if (existsSync(path) && !statSync(path).isDirectory())
        throw new ExtensionError(`${path} is a file. Choose a folder instead.`)
      await updateAppSettings(database, (settings) => ({
        ...settings,
        extensionsDir: path,
      }))
      return rescan()
    },
    /** The bundled frontend entry of an active extension. */
    frontendBundle: (id: string) => {
      const entry = find(id)
      if (entry.status !== 'active' || !entry.manifest?.frontend)
        throw new ExtensionError(`Extension "${id}" has no active frontend`)
      let bundle = frontendBundles.get(id)
      if (!bundle) {
        bundle = bundleEntry(
          entryPath(entry.path, entry.manifest.frontend),
          'frontend',
        )
        frontendBundles.set(id, bundle)
        bundle.catch(() => frontendBundles.delete(id))
      }
      return bundle
    },
    dispose: () => {
      for (const entry of entries) deactivate(entry)
      if (bundleDir) rmSync(bundleDir, { recursive: true, force: true })
    },
  }
}
