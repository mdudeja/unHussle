import type { Static, TSchema } from '@sinclair/typebox'
import type { CommandDefinition } from '@c/workflows/composition'
import type {
  EntryKind,
  EntryRecord,
  MutationCommands,
  MutationInput,
  MutationResult,
} from '@c/workflows/contracts'
import type { SchedulerCommands } from '@c/scheduler/contracts'
import type { VaultCommands } from '@c/vault/contracts'
import type {
  ContainerDetail,
  EntityReference,
  ReadContainerKind,
  ReadPage,
  TaskPageOptions,
} from '@c/types/readModels'
import type { TaskContext } from '@c/types/Hydrated'

export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
export type Disposable = () => void

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

export type SupportedCommands = MutationCommands &
  SchedulerCommands &
  VaultCommands
export type ExecuteSupported = <K extends keyof SupportedCommands>(
  id: K,
  input: SupportedCommands[K]['input'],
) => Promise<SupportedCommands[K]['result']>
export type DomainQueries = {
  list: (
    kind: EntryKind,
    page?: number,
    limit?: number,
  ) => Promise<EntryRecord[]>
  get: (kind: EntryKind, id: string) => Promise<EntryRecord | null>
  references: (
    kind: EntryKind,
    options?: { q?: string; ids?: string[]; cursor?: string; limit?: number },
  ) => Promise<ReadPage<EntityReference>>
  container: (
    kind: ReadContainerKind,
    id: string,
    options?: TaskPageOptions,
  ) => Promise<ContainerDetail | null>
  taskContext: (id: string) => Promise<TaskContext | null>
}
export type ApplicationServices = {
  queries: DomainQueries
  execute: ExecuteSupported
}

export type ExtensionContext = {
  readonly id: string
  readonly services: ApplicationServices
  readonly actions: {
    register: <I extends TSchema, O extends TSchema>(
      action: Action<I, O, ApplicationServices>,
    ) => Disposable
  }
  readonly commands: {
    register: (definition: CommandDefinition) => Disposable
    /** Runs any registered command or workflow by ID. */
    execute: (id: string, input: unknown) => Promise<unknown>
  }
  readonly workflows: {
    register: (definition: WorkflowDefinition) => Disposable
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
  /** Ties another resource's cleanup to the extension's lifetime. */
  readonly own: (dispose: Disposable) => Disposable
}
export type Extension<Extra extends object = object> = {
  activate: (api: ExtensionContext & Extra) => void | Disposable
}

export type AtomicDomain = {
  mutations: {
    apply: (input: MutationInput) => MutationResult
    get: (kind: EntryKind, id: string) => EntryRecord | undefined
  }
}
export type AtomicContributions = {
  atomic: {
    actions: {
      register: <I extends TSchema, O extends TSchema>(
        action: AtomicAction<I, O, AtomicDomain>,
      ) => Disposable
    }
    commands: { register: (definition: CommandDefinition) => Disposable }
  }
}
