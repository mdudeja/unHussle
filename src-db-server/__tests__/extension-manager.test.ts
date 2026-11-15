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

test('settings of an active extension are saved as JSON in the database', async () => {
  const f = await fixture()
  const manager = f.runtime.extensionManager
  await expect(manager.getSetting('sample', 'boards')).rejects.toThrow(
    'not active',
  )
  await manager.setEnabled('sample', true)
  expect(await manager.getSetting('sample', 'boards')).toBeUndefined()
  await manager.setSetting('sample', 'boards', [{ id: 'one' }])
  await expect(
    manager.setSetting('sample', 'boards', () => {}),
  ).rejects.toThrow('JSON values')
  await expect(manager.getSetting('missing', 'boards')).rejects.toThrow(
    'No extension',
  )
  f.runtime.dispose()

  const restarted = createBackendRuntime(f.database, { vaultDir: f.root })
  await restarted.extensionManager.rescan()
  expect(
    await restarted.extensionManager.getSetting('sample', 'boards'),
  ).toEqual([{ id: 'one' }])
  restarted.dispose()
})

test('bundled extensions are listed first, start off and keep their IDs', async () => {
  const bundled = mkdtempSync(join(tmpdir(), 'unhussle-bundled-test-'))
  roots.push(bundled)
  cpSync(SAMPLE, join(bundled, 'builtin'), { recursive: true })
  process.env.BUNDLED_EXTENSIONS_DIR = bundled
  try {
    const f = await fixture()
    const { extensions } = await f.runtime.extensionManager.rescan()
    expect(
      extensions.map(({ folder, bundled, status }) => [
        folder,
        bundled,
        status,
      ]),
    ).toEqual([
      ['builtin', true, 'disabled'],
      ['sample', false, 'invalid'],
    ])
    expect(extensions[1].error).toContain('already used by built-in builtin')
    await f.runtime.extensionManager.setEnabled('sample', true)
    expect(
      (await f.runtime.extensionManager.setDirectory(bundled)).extensions,
    ).toMatchObject([{ folder: 'builtin', bundled: true, enabled: true }])
    f.runtime.dispose()
  } finally {
    delete process.env.BUNDLED_EXTENSIONS_DIR
  }
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

const manifest = (id: string, requires?: string[]) =>
  JSON.stringify({ id, name: id[0].toUpperCase() + id.slice(1), version: '1', requires })

async function dependencyFixture() {
  const f = await fixture()
  folder(f.root, 'tracker', { 'extension.json': manifest('tracker', ['kanban']) })
  folder(f.root, 'kanban', { 'extension.json': manifest('kanban') })
  folder(f.root, 'stats', { 'extension.json': manifest('stats', ['tracker']) })
  await f.runtime.extensionManager.rescan()
  const byId = (list: { extensions: { manifest?: { id: string } }[] }) =>
    Object.fromEntries(
      list.extensions.map((e) => [e.manifest?.id ?? 'none', e]),
    ) as Record<string, { enabled: boolean; status: string; error?: string }>
  return { ...f, manager: f.runtime.extensionManager, byId }
}

test('extensions are listed and started after what they need', async () => {
  const f = await dependencyFixture()
  const ids = f.manager.list().extensions.map((e) => e.manifest?.id)
  expect(ids.indexOf('kanban')).toBeLessThan(ids.indexOf('tracker'))
  expect(ids.indexOf('tracker')).toBeLessThan(ids.indexOf('stats'))
  f.runtime.dispose()
})

test('missing and circular requirements make an extension invalid', async () => {
  const f = await fixture()
  folder(f.root, 'lonely', { 'extension.json': manifest('lonely', ['gone']) })
  folder(f.root, 'chicken', { 'extension.json': manifest('chicken', ['egg']) })
  folder(f.root, 'egg', { 'extension.json': manifest('egg', ['chicken']) })
  folder(f.root, 'nest', { 'extension.json': manifest('nest', ['egg']) })
  const list = await f.runtime.extensionManager.rescan()
  const error = (id: string) =>
    list.extensions.find((e) => e.manifest?.id === id)?.error
  expect(error('lonely')).toBe(`Needs "gone", which isn't installed`)
  expect(error('chicken')).toBe('Dependency cycle: chicken -> egg -> chicken')
  expect(error('nest')).toBe(`Needs "egg", which can't load`)
  await expect(f.runtime.extensionManager.setEnabled('nest', true)).rejects.toThrow(
    `Nest: Needs "egg"`,
  )
  f.runtime.dispose()
})

test('turning on needs requirements on; turning off also turns off dependents', async () => {
  const f = await dependencyFixture()
  await expect(f.manager.setEnabled('stats', true)).rejects.toThrow(
    'Turn on Kanban, Tracker first. Stats needs them.',
  )
  await f.manager.setEnabled('kanban', true)
  await f.manager.setEnabled('tracker', true)
  let list = f.byId(await f.manager.setEnabled('stats', true))
  expect(list.stats).toMatchObject({ enabled: true, status: 'active' })

  list = f.byId(await f.manager.setEnabled('kanban', false))
  for (const id of ['kanban', 'tracker', 'stats'])
    expect(list[id]).toMatchObject({ enabled: false, status: 'disabled' })

  // The cascade is saved, so a restart keeps them off.
  f.runtime.dispose()
  const restarted = createBackendRuntime(f.database, { vaultDir: f.root })
  list = f.byId(await restarted.extensionManager.rescan())
  expect(list.tracker.enabled).toBe(false)
  restarted.dispose()
})

test('dependents restart with their provider and fail while it is down', async () => {
  const f = await dependencyFixture()
  folder(f.root, 'flaky', {
    'extension.json': JSON.stringify({
      id: 'flaky',
      name: 'Flaky',
      version: '1',
      backend: 'backend.ts',
    }),
    'backend.ts': 'export default { activate: () => {} }',
  })
  folder(f.root, 'reader', { 'extension.json': manifest('reader', ['flaky']) })
  await f.manager.rescan()
  await f.manager.setEnabled('flaky', true)
  await f.manager.setEnabled('reader', true)

  writeFileSync(
    join(f.root, 'flaky', 'backend.ts'),
    'export default { activate: () => { throw new Error("boom") } }',
  )
  let list = f.byId(await f.manager.rescan())
  expect(list.flaky.status).toBe('failed')
  expect(list.reader).toMatchObject({
    status: 'failed',
    error: "Needs Flaky, which didn't start",
  })

  writeFileSync(
    join(f.root, 'flaky', 'backend.ts'),
    'export default { activate: () => {} }',
  )
  list = f.byId(await f.manager.rescan())
  expect(list.reader.status).toBe('active')
  // Re-saving the provider restarts what needs it.
  list = f.byId(await f.manager.setEnabled('flaky', true))
  expect(list.reader.status).toBe('active')
  f.runtime.dispose()
})
