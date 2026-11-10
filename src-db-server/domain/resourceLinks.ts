import type { MutationInput } from '@c/workflows/contracts'
import type { PublicationContext } from '@d/workflows/contracts'
import { supporterCapabilities } from './supporters'
import { entityTables } from './entries'
import { and, eq, inArray } from 'drizzle-orm'
import {
  areas,
  goals,
  junctionResources,
  projects,
  resources,
  tasks,
} from '@d/database/schemas'
import type { SyncTx } from '@d/database/repositories/helpers'
import type { ResourceLinkInput, ResourceRef } from '@c/types'
import type { ResourceLinkKind } from '@c/types/Hydrated'

/** Tables a resource can be linked to; `attachedToId` has no foreign key. */
export const linkOwnerTables = { tasks, projects, areas, goals } as const

const linkOwnerKinds = Object.keys(linkOwnerTables) as ResourceLinkKind[]

/** Removes duplicate IDs from a list while preserving their original order. */
const unique = (ids: string[]) => [...new Set(ids)]

/** Computes the difference between two collections by excluding the specified values from the original collection. */
const difference = (from: string[], without: string[]) => {
  const excluded = new Set(without)
  return from.filter((id) => !excluded.has(id))
}

/** Groups owner ids by the table they belong to; unknown ids are dropped. */
export function ownerKindsOf(tx: SyncTx, ids: string[]) {
  const byKind = new Map<ResourceLinkKind, string[]>()
  if (!ids.length) return byKind
  for (const kind of linkOwnerKinds) {
    const table = linkOwnerTables[kind]
    const found = tx
      .select({ id: table.id })
      .from(table)
      .where(inArray(table.id, ids))
      .all()
      .map((row) => row.id)
    if (found.length) byKind.set(kind, found)
  }
  return byKind
}

/**
 * Replaces the resources linked to an owner (task or collection). Returns
 * the resources whose links changed.
 */
export function syncOwnerResources(
  tx: SyncTx,
  ownerId: string,
  refs: ResourceRef[],
): string[] {
  const next = unique(refs.map((ref) => ref.id))
  if (next.length) {
    const found = tx
      .select({ id: resources.id })
      .from(resources)
      .where(inArray(resources.id, next))
      .all()
      .map((row) => row.id)
    const missing = difference(next, found)
    if (missing.length)
      throw new Error(`Resource not found: ${missing.join(', ')}`)
  }

  const current = tx
    .select({ id: junctionResources.refId })
    .from(junctionResources)
    .where(eq(junctionResources.attachedToId, ownerId))
    .all()
    .map((row) => row.id)

  const added = difference(next, current)
  const removed = difference(current, next)
  if (added.length)
    tx.insert(junctionResources)
      .values(added.map((refId) => ({ attachedToId: ownerId, refId })))
      .onConflictDoNothing()
      .run()
  if (removed.length)
    tx.delete(junctionResources)
      .where(
        and(
          eq(junctionResources.attachedToId, ownerId),
          inArray(junctionResources.refId, removed),
        ),
      )
      .run()

  return [...added, ...removed]
}

/**
 * Replaces the tasks and collections a resource is linked to. Returns the
 * owners whose links changed, grouped by kind.
 */
export function syncResourceLinks(
  tx: SyncTx,
  resourceId: string,
  links: ResourceLinkInput[],
) {
  for (const link of links) {
    const table = linkOwnerTables[link.kind]
    if (!table) throw new Error(`Resources can't be linked to ${link.kind}`)
    const found = tx
      .select({ id: table.id })
      .from(table)
      .where(eq(table.id, link.id))
      .get()
    if (!found) throw new Error(`Linked ${link.kind} not found: ${link.id}`)
  }

  const next = unique(links.map((link) => link.id))
  const current = tx
    .select({ id: junctionResources.attachedToId })
    .from(junctionResources)
    .where(eq(junctionResources.refId, resourceId))
    .all()
    .map((row) => row.id)

  const added = difference(next, current)
  const removed = difference(current, next)
  if (added.length)
    tx.insert(junctionResources)
      .values(
        added.map((attachedToId) => ({ attachedToId, refId: resourceId })),
      )
      .onConflictDoNothing()
      .run()
  if (removed.length)
    tx.delete(junctionResources)
      .where(
        and(
          eq(junctionResources.refId, resourceId),
          inArray(junctionResources.attachedToId, removed),
        ),
      )
      .run()

  return ownerKindsOf(tx, [...added, ...removed])
}

/** Owners linked to the given resources (all resources when `ids` is undefined). */
export function ownersOfResources(tx: SyncTx, ids?: string[]) {
  const owners = tx
    .select({ id: junctionResources.attachedToId })
    .from(junctionResources)
    .where(ids ? inArray(junctionResources.refId, ids) : undefined)
    .all()
    .map((row) => row.id)
  return ownerKindsOf(tx, unique(owners))
}

/** Resources linked to the given owners. */
export function resourcesOfOwners(tx: SyncTx, ownerIds: string[]) {
  if (!ownerIds.length) return []
  return unique(
    tx
      .select({ id: junctionResources.refId })
      .from(junctionResources)
      .where(inArray(junctionResources.attachedToId, ownerIds))
      .all()
      .map((row) => row.id),
  )
}

/** Synchronizes a resource’s associated resources and links according to requested changes and announces the resulting updates. */
export function updateResourceLinks(
  tx: SyncTx,
  input: MutationInput,
  { operationId, announce }: PublicationContext,
) {
  const { kind, id, changes = {} } = input
  const { resources: refs, links } = changes
  if (refs !== undefined && !supporterCapabilities[kind]?.resources) {
    throw new Error(`Provided Supporters are not supported for ${kind}`)
  }
  if (links !== undefined && kind !== 'resources') {
    throw new Error(`Links are only supported for resources, got ${kind}`)
  }

  if (!id) return
  if (refs !== undefined) {
    const changed = syncOwnerResources(tx, id, refs as ResourceRef[])
    if (changed.length)
      announce('resources.change', {
        kind: 'resources',
        action: 'update',
        attachedIds: changed,
        operationId,
        result: undefined,
      })
  }
  if (links !== undefined) {
    const owners = syncResourceLinks(tx, id, links as ResourceLinkInput[])
    for (const [ownerKind, attachedIds] of owners)
      announce(`${ownerKind}.change`, {
        kind: ownerKind,
        action: 'update',
        attachedIds,
        operationId,
        result: undefined,
      })
  }
}

/** Publishes change notifications for resource links affected by an entity mutation so dependent owners and resources can update their link state. */
export function announceResourceLinks(
  tx: SyncTx,
  input: MutationInput,
  { operationId, announce }: PublicationContext,
) {
  const { kind, action, id } = input
  if (action !== 'deleteAll' && !id) {
    throw new Error('An entity id is required for announceResourceLinks action')
  }
  const ids = action === 'deleteAll' ? undefined : [id as string]

  if (kind === 'resources') {
    for (const [ownerKind, attachedIds] of ownersOfResources(tx, ids))
      announce(`${ownerKind}.change`, {
        kind: ownerKind,
        action: 'update',
        attachedIds,
        operationId,
        result: undefined,
      })
    return
  }
  if (!supporterCapabilities[kind]?.resources) return
  const ownerIds =
    ids ??
    tx
      .select({ id: entityTables[kind].id })
      .from(entityTables[kind])
      .all()
      .map((row) => row.id as string)
  const attachedIds = resourcesOfOwners(tx, ownerIds)
  if (attachedIds.length)
    announce('resources.change', {
      kind: 'resources',
      action: 'update',
      attachedIds,
      operationId,
      result: undefined,
    })
}
