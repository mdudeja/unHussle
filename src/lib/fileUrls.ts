import { isTauri } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { openPath, openUrl, revealItemInDir } from '@tauri-apps/plugin-opener'
import { Logger } from '@c/Logger'

// The webview has no Bun.fileURLToPath / Bun.pathToFileURL, so these two
// converters are built on the URL API. Tests check them against Bun's.

const WINDOWS_DRIVE = /^[A-Za-z]:[\\/]/
const WINDOWS_DRIVE_PATHNAME = /^\/[A-Za-z]:\//

export const isFileUrl = (url: string): boolean => /^file:\/\//i.test(url)

/** Turns an absolute path (POSIX, Windows drive or UNC) into a file:// URL. */
export function pathToFileUrl(path: string): string {
  const encode = (segments: string[]) =>
    segments.map((segment) => encodeURIComponent(segment)).join('/')

  if (path.startsWith('\\\\')) {
    const [host, ...rest] = path.slice(2).split(/[\\/]/)
    return `file://${host}/${encode(rest)}`
  }
  if (WINDOWS_DRIVE.test(path)) {
    const [drive, ...rest] = path.split(/[\\/]/)
    return `file:///${drive}/${encode(rest)}`
  }
  return `file://${encode(path.split('/'))}`
}

/** Turns a file:// URL into a native path. Throws on other URLs. */
export function fileUrlToPath(url: string): string {
  const parsed = new URL(url)
  if (parsed.protocol !== 'file:') {
    throw new TypeError(`Not a file URL: ${url}`)
  }
  const path = decodeURIComponent(parsed.pathname)
  if (parsed.host) {
    return `\\\\${parsed.host}${path.replace(/\//g, '\\')}`
  }
  if (WINDOWS_DRIVE_PATHNAME.test(path)) {
    return path.slice(1).replace(/\//g, '\\')
  }
  return path
}

/** Last path segment of a file URL, for display. Falls back to the URL. */
export function fileUrlName(url: string): string {
  try {
    const path = fileUrlToPath(url).replace(/[\\/]+$/, '')
    return path.split(/[\\/]/).pop() || path
  } catch {
    return url
  }
}

/** Opens a link: file URLs with the system's default app, others in the browser. */
export async function openLink(url: string): Promise<void> {
  try {
    if (!isTauri()) {
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }
    if (isFileUrl(url)) {
      await openPath(fileUrlToPath(url))
    } else {
      await openUrl(url)
    }
  } catch (error) {
    Logger.getInstance().error('Failed to open link', { error })
  }
}

/** Shows a file URL's target in the system file manager. */
export async function revealLink(url: string): Promise<void> {
  try {
    await revealItemInDir(fileUrlToPath(url))
  } catch (error) {
    Logger.getInstance().error('Failed to reveal file in directory', { error })
  }
}

/** Opens the native picker and returns the chosen file or folder as a file:// URL. */
export async function pickFileUrl({
  directory = false,
}: { directory?: boolean } = {}): Promise<string | undefined> {
  const picked = await open({ directory, multiple: false })
  return typeof picked === 'string' ? pathToFileUrl(picked) : undefined
}
