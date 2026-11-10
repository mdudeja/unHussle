/** Run with `bun run baseline`. Uses only a temporary database and vault. */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from 'zustand/vanilla'
import { useStore, type StoreState } from '@/store'
import { createFrontendRuntime, type EntryTransport } from '@/workflows/runtime'
import { createSseTransport } from '@/workflows/eventStream'
import { mutationHeaders } from '@/services/database/DbService'
import { createTelemetry } from '@c/workflows/telemetry'
import type { EntryKind } from '@c/workflows/contracts'
import { createRelationshipFixture } from './relationshipFixture'

const root = mkdtempSync(join(tmpdir(), 'unhussle-baseline-'))
const reservation = Bun.serve({ port: 0, fetch: () => new Response() })
const port = reservation.port!
await reservation.stop(true)
const address = `http://localhost:${port}`
const server = Bun.spawn([process.execPath, 'run', 'src-db-server/server.ts'], {
  env: {
    ...process.env,
    DB_FILE_URL: join(root, 'baseline.sqlite'),
    VAULT_DIR: join(root, 'vault'),
    DB_MIGRATIONS_DIR: join(process.cwd(), 'drizzle_migrations'),
    VITE_DB_SERVER_PORT: String(port),
    VITE_LOG_LEVEL: 'none',
    NODE_ENV: 'test',
  },
  stdout: 'ignore',
  stderr: 'inherit',
})
type RequestMetric = { method: string; path: string; bytes: number }
let requests: RequestMetric[] = []
/** Send an HTTP request to the configured API and return its parsed JSON response, throwing if the request fails. */
async function request<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const response = await fetch(`${address}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok)
    throw new Error(`${method} ${path}: ${response.status} ${text}`)
  requests.push({ method, path, bytes: Buffer.byteLength(text) })
  return JSON.parse(text) as T
}
let runtime: ReturnType<typeof createFrontendRuntime> | undefined
try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw new Error(`Server exited: ${server.exitCode}`)
    if (
      await fetch(`${address}/health`)
        .then((r) => r.ok)
        .catch(() => false)
    ) {
      ready = true
      break
    }
    await Bun.sleep(100)
  }
  if (!ready) throw new Error('Baseline server startup exceeded 10 seconds')
  const fixture = await createRelationshipFixture((kind, values) =>
    request(`/${kind}`, 'POST', values),
  )
  const kinds = [
    'tasks',
    'projects',
    'areas',
    'goals',
    'resources',
    'tags',
    'urls',
    'time_entries',
  ] as const
  const services = Object.fromEntries(
    kinds.map((kind) => [
      kind,
      {
        fetchPaginated: (page, size) =>
          request(`/${kind}/paginated/${page}/${size}`),
        fetchById: (id) => request(`/${kind}/${id}`),
        search: (term) =>
          request(`/${kind}/search/${encodeURIComponent(term)}`),
        create: (values, options) =>
          request(`/${kind}`, 'POST', values, mutationHeaders(options)),
        update: (id, values, options) =>
          request(`/${kind}/${id}`, 'PATCH', values, mutationHeaders(options)),
        delete: (id, options) =>
          request(
            `/${kind}/${id}`,
            'DELETE',
            undefined,
            mutationHeaders(options),
          ),
        reset: (options) =>
          request(
            `/${kind}/all`,
            'DELETE',
            undefined,
            mutationHeaders(options),
          ),
      } satisfies EntryTransport,
    ]),
  ) as Record<EntryKind, EntryTransport>
  const telemetry = createTelemetry({ side: 'frontend' })
  const transport = createSseTransport({ url: `${address}/events`, telemetry })
  runtime = createFrontendRuntime(
    createStore<StoreState>(() => useStore.getInitialState()),
    {
      services,
      transport,
      telemetry,
      storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    },
  )
  await transport.ready()
  // Represent a tasks view with loaded relationship lists, plus an active search.
  for (const kind of kinds) await runtime.fetchList(kind)
  await runtime.search('tasks', 'Baseline')
  const deactivate = runtime.queries.activate('search:tasks:Baseline')
  const samples = []
  for (let index = 0; index < 5; index++) {
    requests = []
    const start = performance.now()
    await runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id: fixture.tasks.multiplePaths,
      changes: {
        title: `Baseline change ${index}`,
        tags: [{ id: fixture.tag.id, title: fixture.tag.title }],
      },
    })
    const elapsedMs = performance.now() - start
    const counts: Record<string, number> = {}
    for (const { method, path } of requests)
      if (method === 'GET') counts[path] = (counts[path] ?? 0) + 1
    samples.push({
      elapsedMs,
      requests: [...requests],
      duplicateReads: Object.fromEntries(
        Object.entries(counts).filter(([, count]) => count > 1),
      ),
    })
  }
  deactivate()
  const labels = new Map(
    Object.entries(fixture.tasks).map(([name, id]) => [id, name]),
  )
  const relationships = []
  for (const [kind, id] of [
    ['projects', fixture.project.id],
    ['goals', fixture.goal.id],
    ['areas', fixture.area.id],
    ['tags', fixture.tag.id],
  ] as const) {
    requests = []
    const row = await request<import('@c/types/readModels').ContainerDetail>(
      `/${kind}/${id}/detail`,
    )
    relationships.push({
      kind,
      taskNames: row.tasks.items.map((task) => labels.get(task.id)),
      unique:
        new Set(row.tasks.items.map((task) => task.id)).size ===
        row.tasks.items.length,
      count_tasks: row.item.count_tasks,
      resolved_task_total: row.tasks.total,
      responseBytes: requests[0].bytes,
    })
  }
  const report = `${JSON.stringify(
    {
      bun: Bun.version,
      samples,
      relationships,
      signals: telemetry.recent({ kind: 'signal' }).map((span) => span.name),
      note: 'Decoded JSON bytes; excludes SSE and startup/fixture requests. Real HTTP and Bun fetch SSE; no browser render or Tauri timing.',
    },
    null,
    2,
  )}\n`
  if (process.argv[2]) await Bun.write(process.argv[2], report)
  else process.stdout.write(report)
} finally {
  runtime?.dispose()
  server.kill('SIGTERM')
  await server.exited
  rmSync(root, { recursive: true, force: true })
}
