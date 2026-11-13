import type { Resource } from '@c/types'
import type { VaultCommands } from '@c/vault/contracts'
import type { Vault } from '@d/vault/vault'
/** Backend execution types. These are not part of the public command/event API. */
import type { TableWithId } from '@d/database/repositories/BaseRepository'
import type { SyncTx } from '@d/database/repositories/helpers'
import type { transactionRepository } from '@d/workflows/unitOfWork'
import type { AppEvents, MutationCommands } from '@c/workflows/contracts'

export type CommandAction =
  | 'createRow'
  | 'updateRow'
  | 'validateTask'
  | 'trackTaskInterval'
  | 'markPlansStale'
  | 'syncPlanMembership'
  | 'deleteRow'
  | 'deleteAllRows'
  | 'updateSupporters'
  | 'updateSupporterCounts'
  | 'updateGoalProjectStatus'
  | 'updateCollectionCounts'
  | 'updateGoalProjectCompletionData'
  | 'announceAffectedEntities'
  | 'deleteJunctions'
  | 'updateResourceLinks'
  | 'announceResourceLinks'
  | 'syncResourceFile'
  | 'trashResourceFiles'

export type CommandHandlers = {
  [K in keyof MutationCommands]: CommandAction[]
}

/** Queues an event that is published only after the command's transaction commits. */
export type Announce = <K extends keyof AppEvents>(
  name: K,
  payload: AppEvents[K],
) => void

export type PublicationContext = {
  operationId: string
  announce: Announce
}

/**
 * Per-command context handed to every action of that command.
 * `compensate` registers an undo for a side effect outside the database (a
 * vault file); undos run in reverse order if the transaction rolls back.
 * `afterCommit` runs cleanup that integrity doesn't depend on; failures are
 * only logged.
 */
export type ActionContext<Context> = Context &
  PublicationContext & {
    compensate: (undo: () => void) => void
    afterCommit: (run: () => void | Promise<void>) => void
  }

export type TransactionContext = {
  tx: SyncTx
  repository: <Table extends TableWithId>(
    table: Table,
  ) => ReturnType<typeof transactionRepository<Table>>
}

export type TransactionWorkUnit<T> = (context: TransactionContext) => T

export type VaultCommand = keyof VaultCommands

type VaultRequest = {
  [K in VaultCommand]: { command: K; input: VaultCommands[K]['input'] }
}[VaultCommand]

export type VaultState = VaultRequest & {
  now: number
  vault: Vault
  root: string
  compensate: (undo: () => void) => void
  afterCommit: (run: () => void | Promise<void>) => void
  resource?: Resource['Read']
  /** Vault files not stored on any row. */
  unindexed?: Set<string>
  repaired?: number
  missing?: string[]
  result?: VaultCommands[VaultCommand]['result']
  /** Set by an action that has produced the final result early. */
  done?: boolean
}
