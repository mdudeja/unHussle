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
  jsonValueSchema,
  type ExtensionList,
  type ExtensionManifest,
  type InstalledExtension,
} from '@c/extensions/manifest'
import {
  dependencyIssues,
  dependentsOf,
  requirementsOf,
  sortByDependencies,
  type DependencyNode,
} from '@c/extensions/dependencies'
import type { BackendExtension } from '@d/extensions/sdk'
import type { UnHussleDB } from '@d/database/UnHussleDB'
import type { createBackendExtensions } from '@d/extensions/application'
import { bundleEntry } from '@d/extensions/bundle'
import {
  extensionSettings,
  readAppSettings,
  updateAppSettings,
} from '@d/extensions/settings'

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

const nodeOf = ({ manifest }: Entry): DependencyNode | undefined =>
  manifest && { id: manifest.id, requires: manifest.requires }

/**
 * Marks extensions whose requirements can't be met as invalid, and orders
 * the rest so each starts after what it needs.
 */
function withDependencies(entries: Entry[]) {
  const issues = dependencyIssues(entries.flatMap((entry) => nodeOf(entry) ?? []))
  for (const entry of entries) {
    const issue = entry.manifest && issues.get(entry.manifest.id)
    if (issue) {
      entry.status = 'invalid'
      entry.error = issue
    }
  }
  return sortByDependencies(entries, nodeOf)
}

/** Discovers extension folders and activates the ones the user enabled. */
export function createExtensionManager(
  database: UnHussleDB,
  host: ReturnType<typeof createBackendExtensions>,
  logger: Logger,
) {
  const active = new Map<string, Disposable>()
  const settings = extensionSettings(database)
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

  const requireActive = (id: string) => {
    const entry = find(id)
    if (entry.status !== 'active')
      throw new ExtensionError(`Extension "${id}" is not active`)
    return entry
  }

  const nodes = () => entries.flatMap((entry) => nodeOf(entry) ?? [])
  const nameOf = (entry: Entry) => entry.manifest?.name ?? entry.folder

  /** Starts an extension once everything it needs is running. */
  const start = async (entry: Entry) => {
    if (entry.status === 'invalid') return
    for (const id of entry.manifest?.requires ?? []) {
      const required = find(id)
      const problem = !required.enabled
        ? 'is off'
        : required.status !== 'active'
          ? "didn't start"
          : undefined
      if (problem) {
        entry.status = 'failed'
        entry.error = `Needs ${nameOf(required)}, which ${problem}`
        return
      }
    }
    await activate(entry)
  }

  /** Turned-on extensions that need this one, in start order. */
  const enabledDependents = (id: string) =>
    dependentsOf(nodes(), id)
      .map(find)
      .filter((entry) => entry.enabled)

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

  const subfolders = (root: string) =>
    readdirSync(root, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name)
      .sort()

  /** Bundled extensions are read first, so they keep their IDs. */
  const scan = async (enabled: string[]) => {
    mkdirSync(directory, { recursive: true })
    const bundledRoot = process.env.BUNDLED_EXTENSIONS_DIR
    const roots = [
      ...(bundledRoot && existsSync(bundledRoot)
        ? [{ root: bundledRoot, bundled: true }]
        : []),
      ...(bundledRoot && resolve(bundledRoot) === resolve(directory)
        ? []
        : [{ root: directory, bundled: false }]),
    ]
    const seen = new Map<string, string>()
    const next: Entry[] = []
    for (const { root, bundled } of roots)
      for (const folder of subfolders(root)) {
        const path = join(root, folder)
        try {
          const manifest = await readManifest(path)
          const other = seen.get(manifest.id)
          if (other)
            throw new Error(`ID "${manifest.id}" is already used by ${other}`)
          seen.set(manifest.id, bundled ? `built-in ${folder}` : folder)
          next.push({
            folder,
            path,
            bundled,
            manifest,
            enabled: enabled.includes(manifest.id),
            status: 'disabled',
          })
        } catch (error) {
          next.push({
            folder,
            path,
            bundled,
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
    entries = withDependencies(await scan(settings.enabledExtensions ?? []))
    for (const entry of entries) if (entry.enabled) await start(entry)
    return list()
  }

  return {
    list,
    rescan,
    /**
     * Turning on needs what it requires to be on already. Turning off also
     * turns off what needs it. Dependents restart with their provider.
     */
    setEnabled: async (id: string, enabled: boolean) => {
      const entry = find(id)
      if (enabled) {
        if (entry.status === 'invalid')
          throw new ExtensionError(`${nameOf(entry)}: ${entry.error}`)
        const off = requirementsOf(nodes(), id)
          .map(find)
          .filter((required) => !required.enabled)
        if (off.length)
          throw new ExtensionError(
            `Turn on ${off.map(nameOf).join(', ')} first. ${nameOf(entry)} needs ${off.length > 1 ? 'them' : 'it'}.`,
          )
      }
      const dependents = enabledDependents(id)
      const changed = enabled ? [entry] : [entry, ...dependents]
      const ids = changed.map((item) => item.manifest!.id)
      await updateAppSettings(database, (settings) => {
        const others = (settings.enabledExtensions ?? []).filter(
          (value) => !ids.includes(value),
        )
        return {
          ...settings,
          enabledExtensions: enabled ? [...others, id] : others,
        }
      })
      for (const item of [entry, ...dependents].reverse()) deactivate(item)
      if (enabled) {
        entry.enabled = true
        await start(entry)
        for (const dependent of dependents) await start(dependent)
      } else
        for (const item of changed) {
          item.enabled = false
          if (item.status === 'invalid') continue
          item.status = 'disabled'
          item.error = undefined
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
    /** Settings of an active extension, for its frontend entry. */
    getSetting: async (id: string, key: string) => {
      requireActive(id)
      return settings.get(id, key)
    },
    setSetting: async (id: string, key: string, value: unknown) => {
      requireActive(id)
      if (!Value.Check(jsonValueSchema, value))
        throw new ExtensionError('Settings must be JSON values')
      return settings.set(id, key, value)
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
