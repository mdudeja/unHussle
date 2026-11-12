import { withTestServer } from '@c/testing/runWithServer'

try {
  const paths = process.argv.slice(2)
  process.exitCode = await withTestServer({
    server: [process.execPath, 'run', 'src-db-server/server.ts'],
    tests: [
      process.execPath,
      'test',
      ...(paths.length
        ? paths
        : ['common/__tests__', 'src-db-server/__tests__', 'src/__tests__']),
    ],
    address: `http://localhost:${process.env.VITE_DB_SERVER_PORT || '3457'}`,
  })
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Test runner failed'}\n`,
  )
  process.exitCode = 1
}
