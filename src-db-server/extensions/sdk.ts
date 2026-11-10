/** Public backend authoring surface. No runtime, repository, or transaction exports. */
export { SDK_VERSION } from '@c/extensions/sdk'
export type {
  ApplicationServices,
  AtomicDomain,
  AtomicContributions,
  JsonValue,
  WorkflowDefinition,
} from '@c/extensions/sdk'
export type BackendExtension = import('@c/extensions/sdk').Extension<
  import('@c/extensions/sdk').ApplicationServices,
  import('@c/extensions/sdk').AtomicContributions
>
