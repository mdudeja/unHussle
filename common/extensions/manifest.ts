import { Type, type Static } from '@sinclair/typebox'

const RESERVED_IDS = ['kernel', 'unhussle']
const ID_PATTERN = '^[a-z][a-z0-9_-]*$'

/** Contents of `extension.json`; entry paths are relative to its folder. */
export const extensionManifestSchema = Type.Object(
  {
    id: Type.String({ pattern: ID_PATTERN }),
    name: Type.String({ minLength: 1 }),
    version: Type.String({ minLength: 1 }),
    description: Type.Optional(Type.String()),
    backend: Type.Optional(Type.String({ minLength: 1 })),
    frontend: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
)
export type ExtensionManifest = Static<typeof extensionManifestSchema>

export function assertExtensionId(id: string) {
  if (!new RegExp(ID_PATTERN).test(id) || RESERVED_IDS.includes(id))
    throw new Error(
      `Invalid extension ID "${id}": use lowercase letters, digits, "-" or "_", starting with a letter`,
    )
}

export const extensionStatusSchema = Type.Union([
  Type.Literal('disabled'),
  Type.Literal('active'),
  Type.Literal('failed'),
  Type.Literal('invalid'),
])
export type ExtensionStatus = Static<typeof extensionStatusSchema>

/** One folder in the extensions directory; `manifest` is absent when invalid. */
export const installedExtensionSchema = Type.Object({
  folder: Type.String(),
  manifest: Type.Optional(extensionManifestSchema),
  enabled: Type.Boolean(),
  status: extensionStatusSchema,
  error: Type.Optional(Type.String()),
})
export type InstalledExtension = Static<typeof installedExtensionSchema>

export const extensionListSchema = Type.Object({
  directory: Type.String(),
  extensions: Type.Array(installedExtensionSchema),
})
export type ExtensionList = Static<typeof extensionListSchema>

/** Global through which bundled extensions receive the host's shared modules. */
export const SHARED_MODULES_GLOBAL = '__unhussle'
/** Imports an extension may use without bundling its own copy. */
export const sharedModules = {
  backend: ['@sinclair/typebox', 'unhussle/backend'],
  frontend: [
    'react',
    'react/jsx-runtime',
    '@sinclair/typebox',
    'unhussle/frontend',
  ],
} as const
export type ExtensionSide = keyof typeof sharedModules
