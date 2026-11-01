import { describe, test, expect } from 'bun:test'
import {
  fileUrlName,
  fileUrlToPath,
  isFileUrl,
  pathToFileUrl,
} from '@/lib/fileUrls'

const posixPaths = [
  '/home/me/notes.md',
  '/home/me/My Docs/a#b?.md',
  '/tmp/ünï cødé/x@y!.txt',
  '/tmp/100% done/[draft] (v2).md',
  '/tmp/dir/',
]

describe('file URLs', () => {
  test('recognizes file URLs', () => {
    expect(isFileUrl('file:///tmp/a.txt')).toBe(true)
    expect(isFileUrl('FILE:///tmp/a.txt')).toBe(true)
    expect(isFileUrl('https://example.com')).toBe(false)
    expect(isFileUrl('/tmp/a.txt')).toBe(false)
  })

  test.each(posixPaths)('pathToFileUrl matches Bun for %s', (path) => {
    expect(Bun.fileURLToPath(pathToFileUrl(path))).toBe(path)
  })

  test.each(posixPaths)('fileUrlToPath matches Bun for %s', (path) => {
    expect(fileUrlToPath(Bun.pathToFileURL(path).href)).toBe(path)
  })

  test('produces a valid URL', () => {
    expect(() => new URL(pathToFileUrl('/tmp/My Docs/a#b?.md'))).not.toThrow()
    expect(pathToFileUrl('/tmp/My Docs/a.md')).toBe(
      'file:///tmp/My%20Docs/a.md',
    )
  })

  test('handles Windows drive paths', () => {
    const url = pathToFileUrl('C:\\Users\\Me\\My Docs\\a.md')
    expect(url).toBe('file:///C:/Users/Me/My%20Docs/a.md')
    expect(fileUrlToPath(url)).toBe('C:\\Users\\Me\\My Docs\\a.md')
  })

  test('handles UNC paths', () => {
    const url = pathToFileUrl('\\\\server\\share\\a b.md')
    expect(url).toBe('file://server/share/a%20b.md')
    expect(fileUrlToPath(url)).toBe('\\\\server\\share\\a b.md')
  })

  test('rejects other schemes', () => {
    expect(() => fileUrlToPath('https://example.com/a')).toThrow()
  })

  test('names a file or folder', () => {
    expect(fileUrlName('file:///tmp/My%20Docs/a.md')).toBe('a.md')
    expect(fileUrlName('file:///tmp/My%20Docs/')).toBe('My Docs')
    expect(fileUrlName('file:///C:/Users/Me/b.txt')).toBe('b.txt')
  })
})
