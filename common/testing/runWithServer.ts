/** Ignore data on the temporary port reservation. */
function ignoreData() {}
/** Close accidental connections to the reservation. */
function closeSocket(socket: { end: () => unknown }) {
  socket.end()
}

/** Owns only its child server, with bounded health polling and shutdown. */
export async function withTestServer(options: {
  server: string[]
  tests: string[]
  address: string
  timeoutMs?: number
  env?: Record<string, string | undefined>
}): Promise<number> {
  const url = new URL(options.address)
  const reservation = Bun.listen({
    hostname: url.hostname,
    port: Number(url.port),
    socket: { data: ignoreData, open: closeSocket },
  })
  reservation.stop(true)
  const runId = crypto.randomUUID()
  const env = {
    ...(options.env ?? process.env),
    NODE_ENV: 'test',
    UNHUSSLE_TEST_RUN_ID: runId,
  }
  const server = Bun.spawn(options.server, {
    env,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  let interrupted = false
  let tests: ReturnType<typeof Bun.spawn> | undefined
  /** Stops any running tests and server and marks the current run as interrupted. */
  const stop = () => {
    interrupted = true
    tests?.kill('SIGTERM')
    server.kill('SIGTERM')
  }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  try {
    const deadline = performance.now() + (options.timeoutMs ?? 10000)
    for (;;) {
      if (interrupted) return 130
      if (server.exitCode !== null)
        throw new Error('Test server exited before readiness')
      const remaining = deadline - performance.now()
      if (remaining <= 0)
        throw new Error('Test server health deadline exceeded')
      const healthy = await fetch(`${options.address}/health`, {
        signal: AbortSignal.timeout(Math.max(1, Math.min(remaining, 500))),
      })
        .then(
          async (response) =>
            response.ok &&
            response.headers.get('x-test-server-id') === runId &&
            (await response.text()) === 'OK',
        )
        .catch(() => false)
      if (server.exitCode !== null)
        throw new Error('Test server exited before readiness')
      if (healthy) break
      await Promise.race([
        server.exited,
        Bun.sleep(Math.min(100, Math.max(1, deadline - performance.now()))),
      ])
    }
    tests = Bun.spawn(options.tests, {
      env: options.env ?? process.env,
      stdout: 'inherit',
      stderr: 'inherit',
    })
    const result = await Promise.race<{
      source: 'tests' | 'server'
      code: number
    }>([
      tests.exited.then((code) => ({ source: 'tests', code })),
      server.exited.then((code) => ({ source: 'server', code })),
    ])
    if (interrupted) return 130
    if (result.source === 'server') {
      tests.kill('SIGTERM')
      await tests.exited
      throw new Error('Test server exited during tests')
    }
    return result.code
  } finally {
    process.off('SIGTERM', stop)
    process.off('SIGINT', stop)
    tests?.kill('SIGTERM')
    server.kill('SIGTERM')
    const timeout = setTimeout(() => server.kill('SIGKILL'), 2000)
    try {
      await server.exited
    } finally {
      clearTimeout(timeout)
    }
  }
}
