import { expect, test } from 'bun:test'
import { withTestServer } from '@c/testing/runWithServer'

const healthServer = `Bun.serve({port:Number(process.env.RUNNER_PORT),fetch:()=>new Response('OK',{headers:{'x-test-server-id':process.env.UNHUSSLE_TEST_RUN_ID}})})`
/** Determines an available network port for use by a server. */
function port() {
  const server = Bun.serve({ port: 0, fetch: () => new Response() })
  const value = server.port!
  void server.stop(true)
  return value
}
/** Builds the configuration used to launch a server and run tests against it on a local port. */
function options(server: string, exit = 0) {
  const value = port()
  return {
    server: [process.execPath, '-e', server],
    tests: [process.execPath, '-e', `process.exit(${exit})`],
    address: `http://localhost:${value}`,
    timeoutMs: 1000,
    env: { ...process.env, RUNNER_PORT: String(value) },
  }
}

test('test runner polls readiness and preserves a nonzero test exit status', async () => {
  expect(await withTestServer(options(healthServer, 7))).toBe(7)
})
test('test runner detects startup failure without running tests', async () => {
  await expect(withTestServer(options('process.exit(13)'))).rejects.toThrow(
    'before readiness',
  )
})
test('test runner bounds startup health polling and cleans up its child', async () => {
  const config = options(
    healthServer.replace("new Response('OK'", "new Response('Not ready'"),
  )
  config.timeoutMs = 100
  await expect(withTestServer(config)).rejects.toThrow('deadline')
  const replacement = Bun.serve({
    port: Number(new URL(config.address).port),
    fetch: () => new Response('free'),
  })
  void replacement.stop(true)
})
test('test runner rejects an occupied port and never kills the preexisting server', async () => {
  const existing = Bun.serve({ port: 0, fetch: () => new Response('existing') })
  try {
    const config = {
      ...options(healthServer),
      address: `http://localhost:${existing.port}`,
    }
    await expect(withTestServer(config)).rejects.toThrow()
    expect(
      await fetch(config.address).then((response) => response.text()),
    ).toBe('existing')
  } finally {
    void existing.stop(true)
  }
})

test('test runner detects a child exiting during tests', async () => {
  const config = options(healthServer + ';setTimeout(()=>process.exit(17),300)')
  config.tests = [process.execPath, '-e', 'await Bun.sleep(2000)']
  await expect(withTestServer(config)).rejects.toThrow('during tests')
})
