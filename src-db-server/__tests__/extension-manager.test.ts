import { afterAll, expect, test } from 'bun:test'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createBackendRuntime } from '@d/bootstrap'
import { UnHussleDB } from '@d/database/UnHussleDB'

const SAMPLE = join(import.meta.dir, '../../examples/extensions/sample')
const roots: string[] = []
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function folder(root: string, name: string, files: Record<string, string>) {
  mkdirSync(join(root, name))
  for (const [file, contents] of Object.entries(files))
    writeFileSync(join(root, name, file), contents)
}

async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'unhussle-extensions-test-'))
  roots.push(root)
  cpSync(SAMPLE, join(root, 'sample'), { recursive: true })
  const database = new UnHussleDB(':memory:')
  const runtime = createBackendRuntime(database, { vaultDir: root })
  await runtime.extensionManager.setDirectory(root)
  return { root, database, runtime }
}

test('discovered extensions start disabled; invalid folders report why', async () => {
  const f = await fixture()
  folder(f.root, 'broken', { 'extension.json': '{ not json' })
  folder(f.root, 'nameless', { 'extension.json': '{"id":"x","version":"1"}' })
  folder(f.root, 'copy', {
    'extension.json': '{"id":"sample","name":"Copy","version":"1"}',
  })
  folder(f.root, 'empty', {})
  const { extensions } = await f.runtime.extensionManager.rescan()
  const byFolder = Object.fromEntries(extensions.map((e) => [e.folder, e]))
  expect(byFolder.copy).toMatchObject({ enabled: false, status: 'disabled' })
  expect(byFolder.broken.error).toContain('not valid JSON')
  expect(byFolder.nameless.error).toContain('/name')
  expect(byFolder.empty.error).toContain('Missing extension.json')
  // Folders are read alphabetically, so "copy" claims the ID first.
  expect(byFolder.sample.status).toBe('invalid')
  expect(byFolder.sample.error).toContain('already used by copy')
  f.runtime.dispose()
})

test('enabling activates the backend entry and persists across restarts', async () => {
  const f = await fixture()
  const list = await f.runtime.extensionManager.setEnabled('sample', true)
  expect(list.extensions[0]).toMatchObject({ enabled: true, status: 'active' })
  expect(f.runtime.registry.definition('sample.capture').id).toBe(
    'sample.capture',
  )
  f.runtime.dispose()

  const restarted = createBackendRuntime(f.database, { vaultDir: f.root })
  const { extensions } = await restarted.extensionManager.rescan()
  expect(extensions[0]).toMatchObject({ enabled: true, status: 'active' })
  await restarted.extensionManager.setEnabled('sample', false)
  expect(() => restarted.registry.definition('sample.capture')).toThrow(
    'Missing command',
  )
  restarted.dispose()
})

test('a failing activation is reported without stopping other extensions', async () => {
  const f = await fixture()
  folder(f.root, 'thrower', {
    'extension.json':
      '{"id":"thrower","name":"Thrower","version":"1","backend":"backend.ts"}',
    'backend.ts':
      'export default { activate: () => { throw new Error("boom") } }',
  })
  await f.runtime.extensionManager.rescan()
  await f.runtime.extensionManager.setEnabled('sample', true)
  const { extensions } = await f.runtime.extensionManager.setEnabled(
    'thrower',
    true,
  )
  const thrower = extensions.find((e) => e.folder === 'thrower')!
  expect(thrower).toMatchObject({ status: 'failed', error: 'boom' })
  expect(extensions.find((e) => e.folder === 'sample')?.status).toBe('active')
  f.runtime.dispose()
})

test('frontend bundles use host modules and need an active extension', async () => {
  const f = await fixture()
  expect(() => f.runtime.extensionManager.frontendBundle('sample')).toThrow(
    'no active frontend',
  )
  await f.runtime.extensionManager.setEnabled('sample', true)
  const code = await f.runtime.extensionManager.frontendBundle('sample')
  expect(code).toContain('globalThis["__unhussle"]["react/jsx-runtime"]')
  expect(code).toContain('globalThis["__unhussle"]["unhussle/frontend"]')
  f.runtime.dispose()
})

test('the folder must be an absolute path to a directory', async () => {
  const f = await fixture()
  const manager = f.runtime.extensionManager
  await expect(manager.setDirectory('relative/path')).rejects.toThrow(
    'full folder',
  )
  writeFileSync(join(f.root, 'file.txt'), '')
  await expect(manager.setDirectory(join(f.root, 'file.txt'))).rejects.toThrow(
    'is a file',
  )
  await expect(manager.setEnabled('missing', true)).rejects.toThrow(
    'No extension',
  )
  f.runtime.dispose()
})
