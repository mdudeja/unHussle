import { Logger } from '@c/Logger'
import { $ } from 'bun'
import { join } from 'node:path'

try {
  const targetTriple = (await $`rustc --print host-tuple`.text()).replace(
    /\s+/g,
    '',
  )
  const filePath = join(
    process.cwd(),
    process.env.DB_SERVER_BUILD_DIR || './binaries',
  )
  const outputPath = `${filePath}/db-server-${targetTriple}`
  const entrypointPath = join(process.cwd(), 'src-db-server', 'server.ts')

  // Linux
  await Bun.build({
    env: 'VITE_*',
    entrypoints: [entrypointPath],
    compile: {
      target: 'bun-linux-x64',
      outfile: outputPath,
    },
  })

  // macOS
  //   await Bun.build({
  //     env: 'inline',
  //     entrypoints: ['./server.ts'],
  //     compile: {
  //       target: 'bun-darwin-x64',
  //       outfile: outputPath,
  //     },
  //   })

  // Windows
  //   await Bun.build({
  //     env: 'inline',
  //     entrypoints: ['./server.ts'],
  //     compile: {
  //       target: 'bun-windows-x64',
  //       outfile: outputPath,
  //     },
  //   })
} catch (err) {
  Logger.getInstance().error(`Build failed: ${err as string}`)
  process.exit(1)
}

export {}
