import type { EntryKind, EntryRecord } from '@c/workflows/contracts'
import type { TransactionContext } from '@d/workflows/contracts'
import type { TableWithId } from '@d/database/repositories/BaseRepository'
import * as tables from '@d/database/schemas'
import { normalizeTagTitle } from './supporters'
import { toUrlParts } from '@d/database/repositories/helpers'

const entityTables: { [K in EntryKind]: TableWithId } = {
  tasks: tables.tasks,
  projects: tables.projects,
  areas: tables.areas,
  goals: tables.goals,
  resources: tables.resources,
  tags: tables.tags,
  urls: tables.urls,
  time_entries: tables.timeEntries,
}

/**
 * Strips supporter and link keys, derived count columns and vault-owned
 * resource columns, and applies per-kind normalization to row values.
 */
function toRowValues(kind: EntryKind, changes: Record<string, unknown>) {
  const {
    tags: _tags,
    urls: _urls,
    time_entries: _time_entries,
    resources: _resources,
    links: _links,
    count_tasks: _count_tasks,
    count_resources: _count_resources,
    count_pga: _count_pga,
    resolved_task_total: _resolved_task_total,
    missing: _missing,
    content: _content,
    file_path: _file_path,
    content_hash: _content_hash,
    ...values
  } = changes

  // Status transitions are tracked here, so their time totals are backend-owned.
  if (kind === 'tasks' && 'status' in values) {
    delete values.spent_minutes
    delete values.started_at
    delete values.completed_at
  }

  if (kind === 'urls' && typeof values.url === 'string') {
    values.parts = toUrlParts(values.url)
  }

  if (kind === 'tags' && typeof values.title === 'string') {
    values.title = normalizeTagTitle(values.title)
  }

  return values
}

/** Row persistence with server-owned fields stripped, shared by every mutation family. */
export function createEntry(
  { repository }: TransactionContext,
  kind: EntryKind,
  changes: Record<string, unknown>,
) {
  const row = repository(entityTables[kind]).insert(toRowValues(kind, changes))
  if (!row) throw new Error(`Failed to insert ${kind}`)
  return row as EntryRecord
}
export function updateEntry(
  { repository }: TransactionContext,
  kind: EntryKind,
  id: string,
  changes: Record<string, unknown>,
) {
  const row = repository(entityTables[kind]).update(
    id,
    toRowValues(kind, changes),
  )
  if (!row) throw new Error('NOT_FOUND')
  return row as EntryRecord
}
export function deleteEntry(
  { repository }: TransactionContext,
  kind: EntryKind,
  id: string,
) {
  const row = repository(entityTables[kind]).delete(id)
  if (!row) throw new Error('NOT_FOUND')
  return row as EntryRecord
}
export function deleteAllEntries(
  { repository }: TransactionContext,
  kind: EntryKind,
) {
  return repository(entityTables[kind]).deleteAll() as EntryRecord[]
}
export { entityTables }
