/** Public backend authoring surface (`unhussle/backend`). Types only. */
import type { AtomicContributions, Extension } from '@c/extensions/sdk'
export type {
  ApplicationServices,
  AtomicDomain,
  AtomicContributions,
  JsonValue,
  WorkflowDefinition,
} from '@c/extensions/sdk'
export type BackendExtension = Extension<AtomicContributions>
