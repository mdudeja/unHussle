import type { Static, TSchema } from '@sinclair/typebox'
import type { CommandDefinition } from '@c/workflows/composition'

export const SDK_VERSION = 1 as const
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type Disposable = () => void
export type Override = { override?: boolean }
export type WorkflowDefinition = Omit<
  CommandDefinition,
  'steps' | 'execution'
> & {
  steps: {
    id: string
    command: string
    input: CommandDefinition['steps'][number]['input']
  }[]
}
export type Action<I extends TSchema, O extends TSchema, C> = {
  id: string
  description: string
  input: I
  output: O
  run: (input: Static<I>, context: C) => Static<O> | Promise<Static<O>>
}
export type AtomicAction<I extends TSchema, O extends TSchema, C> = Omit<
  Action<I, O, C>,
  'run'
> & {
  run: (input: Static<I>, context: C) => Static<O>
}
export type ExtensionContext<S> = {
  readonly id: string
  readonly sdkVersion: typeof SDK_VERSION
  readonly services: S
  readonly commands: {
    register: (definition: CommandDefinition, options?: Override) => Disposable
    execute: (id: string, input: unknown) => Promise<unknown>
  }
  readonly actions: {
    register: <I extends TSchema, O extends TSchema>(
      action: Action<I, O, S>,
      options?: Override,
    ) => Disposable
  }
  readonly workflows: {
    register: (definition: WorkflowDefinition, options?: Override) => Disposable
    execute: (id: string, input: unknown) => Promise<unknown>
  }
  readonly events: {
    on: (
      name: string,
      listener: (payload: unknown) => void | Promise<void>,
    ) => Disposable
  }
  readonly settings: {
    get: (key: string) => Promise<JsonValue | undefined>
    set: (key: string, value: JsonValue) => Promise<void>
  }
  readonly log: {
    info: (message: string) => void
    error: (message: string, error: unknown) => void
  }
  /** Additional resources acquired by activation share the plugin's lifetime. */
  readonly own: (dispose: Disposable) => Disposable
}
export type Extension<S, Extra extends object = object> = {
  id: string
  sdkVersion: number
  activate: (api: ExtensionContext<S> & Extra) => void | Disposable
}

export type SupportedCommands =
  import('@c/workflows/contracts').MutationCommands &
    import('@c/scheduler/contracts').SchedulerCommands &
    import('@c/vault/contracts').VaultCommands
export type ExecuteSupported = <K extends keyof SupportedCommands>(
  id: K,
  input: SupportedCommands[K]['input'],
) => Promise<SupportedCommands[K]['result']>
export type DomainQueries = {
  list: (
    kind: import('@c/workflows/contracts').EntryKind,
    page?: number,
    limit?: number,
  ) => Promise<import('@c/workflows/contracts').EntryRecord[]>
  get: (
    kind: import('@c/workflows/contracts').EntryKind,
    id: string,
  ) => Promise<import('@c/workflows/contracts').EntryRecord | null>
  references: (
    kind: import('@c/workflows/contracts').EntryKind,
    options?: { q?: string; ids?: string[]; cursor?: string; limit?: number },
  ) => Promise<
    import('@c/types/readModels').ReadPage<
      import('@c/types/readModels').EntityReference
    >
  >
  container: (
    kind: import('@c/types/readModels').ReadContainerKind,
    id: string,
    options?: import('@c/types/readModels').TaskPageOptions,
  ) => Promise<import('@c/types/readModels').ContainerDetail | null>
  taskContext: (
    id: string,
  ) => Promise<import('@c/types/Hydrated').TaskContext | null>
}
export type ApplicationServices = {
  queries: DomainQueries
  execute: ExecuteSupported
}
export type AtomicDomain = {
  mutations: {
    apply: (
      input: import('@c/workflows/contracts').MutationInput,
    ) => import('@c/workflows/contracts').MutationResult
    get: (
      kind: import('@c/workflows/contracts').EntryKind,
      id: string,
    ) => import('@c/workflows/contracts').EntryRecord | undefined
  }
}
export type AtomicContributions = {
  atomic: {
    action: <I extends TSchema, O extends TSchema>(
      action: AtomicAction<I, O, AtomicDomain>,
      options?: Override,
    ) => Disposable
    command: (definition: CommandDefinition, options?: Override) => Disposable
    execute: (id: string, input: unknown) => Promise<unknown>
  }
}
