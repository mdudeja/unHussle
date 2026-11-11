import * as TypeBox from '@sinclair/typebox'
import {
  SHARED_MODULES_GLOBAL,
  sharedModules,
  type ExtensionSide,
} from '@c/extensions/manifest'

const SHARED_NAMESPACE = 'unhussle-shared'

// Backend bundles read these at import time; `unhussle/backend` is types only.
Object.assign(globalThis, {
  [SHARED_MODULES_GLOBAL]: {
    '@sinclair/typebox': TypeBox,
    'unhussle/backend': {},
  },
})

/**
 * Bundles an extension entry into one ES module. Shared imports become reads
 * of the host's global, so extensions need no `node_modules` and use the
 * host's React and TypeBox instances.
 */
export async function bundleEntry(entry: string, side: ExtensionSide) {
  const shared = new Set<string>(sharedModules[side])
  const result = await Bun.build({
    entrypoints: [entry],
    target: side === 'backend' ? 'bun' : 'browser',
    format: 'esm',
    throw: false,
    // Shared React is the production build; without the define, Bun picks
    // the dev JSX runtime whenever NODE_ENV is "development".
    jsx: { runtime: 'automatic', development: false },
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'unhussle-shared-modules',
        setup(build) {
          build.onResolve({ filter: /.*/ }, ({ path }) =>
            shared.has(path)
              ? { path, namespace: SHARED_NAMESPACE }
              : undefined,
          )
          build.onLoad(
            { filter: /.*/, namespace: SHARED_NAMESPACE },
            ({ path }) => ({
              contents: `module.exports = globalThis[${JSON.stringify(SHARED_MODULES_GLOBAL)}][${JSON.stringify(path)}]`,
              loader: 'js',
            }),
          )
        },
      },
    ],
  })
  if (!result.success)
    throw new Error(
      `Could not build ${entry}: ${result.logs.map(String).join('; ')}`,
    )
  return result.outputs[0].text()
}
