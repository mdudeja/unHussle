import { createRuntime } from '@c/workflows/runtime'
import type {
  AppEvents,
  MutationCommands,
  MutationResult,
  EntityRecord,
} from '@c/workflows/contracts'
import type { TagInput, UrlInput } from '@c/types'
import { Logger } from '@c/Logger'
import { UnHussleDB } from '@d/database/UnHussleDB'
import * as tables from '@d/database/schemas'
import { toUrlParts } from '@d/database/repositories/helpers'
import { createUnitOfWork } from './unitOfWork'
import {
  attachmentCapabilities,
  removeOwnerAttachments,
  removeReferenceAttachments,
  syncAttachments,
} from './attachments'

const entityTables = {
  tasks: tables.tasks,
  projects: tables.projects,
  areas: tables.areas,
  goals: tables.goals,
  resources: tables.resources,
  tags: tables.tags,
  urls: tables.urls,
  time_entries: tables.timeEntries,
}

export function createBackendRuntime(database: UnHussleDB) {
  const context = {
    unitOfWork: createUnitOfWork(database),
    logger: Logger.getInstance(),
  }
  const runtime = createRuntime<MutationCommands, AppEvents, typeof context>(
    context,
  )
  runtime.commands.handle(
    'entity.mutate',
    async (input, { unitOfWork, logger }) => {
      const operationId = crypto.randomUUID()
      const { kind, action, id, changes = {} } = input
      const { tags, urls, ...values } = changes
      const capability = attachmentCapabilities[kind]
      if (
        (tags !== undefined && !capability?.tags) ||
        (urls !== undefined && !capability?.urls)
      ) {
        throw new Error(`Attachments are not supported for ${kind}`)
      }
      if (kind === 'urls' && typeof values.url === 'string')
        values.parts = toUrlParts(values.url)
      const result = (await unitOfWork.transaction(({ tx, repository }) => {
        const repo = repository(entityTables[kind])
        if (action === 'deleteAll') {
          const ids = repo.all().map((row) => row.id)
          removeOwnerAttachments(tx, ids)
          removeReferenceAttachments(tx, kind, ids)
          return { deleted: repo.deleteAll().length }
        }
        if (action === 'delete') {
          if (!id) throw new Error('An entity id is required')
          removeOwnerAttachments(tx, [id])
          removeReferenceAttachments(tx, kind, [id])
          const row = repo.delete(id)
          if (!row) throw new Error('NOT_FOUND')
          return row
        }
        const row =
          action === 'create'
            ? repo.insert(
                values as (typeof entityTables)[typeof kind]['$inferInsert'],
              )
            : id
              ? repo.update(id, values)
              : undefined
        if (!row)
          throw new Error(
            action === 'create' ? `Failed to insert ${kind}` : 'NOT_FOUND',
          )
        if (capability)
          syncAttachments(
            tx,
            row.id,
            {
              tags: tags as TagInput[] | undefined,
              urls: urls as UrlInput[] | undefined,
            },
            { replace: action === 'update' },
          )
        return row
      })) as MutationResult
      const outcomes = await runtime.events.publish('entity.changed', {
        ...input,
        operationId,
        result,
      })
      for (const outcome of outcomes)
        if (outcome.status === 'rejected') {
          logger.error(
            `Post-commit listener failed (${operationId}): ${String(outcome.reason)}`,
          )
        }
      return result
    },
  )
  return {
    ...runtime,
    async hydrate<T>(
      result: MutationResult,
      read: (id: string) => Promise<T | null>,
    ) {
      try {
        const hydrated = await read((result as EntityRecord).id)
        if (!hydrated) throw new Error('Committed entity could not be loaded')
        return hydrated
      } catch (error) {
        context.logger.error(
          `Post-commit hydration failed; write must not be retried automatically: ${String(error)}`,
        )
        throw error
      }
    },
  }
}

export const backendRuntime = createBackendRuntime(UnHussleDB.getInstance())
