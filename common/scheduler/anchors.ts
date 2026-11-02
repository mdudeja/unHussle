import { AnchorType } from '@c/types'
import type { PlanEntry } from './contracts'
import { isPending } from './status'

export const isBeforeAnchor = (item: PlanEntry) =>
  item.anchorType === AnchorType.before ||
  item.anchorType === AnchorType.any_before
const isAdjacent = (item: PlanEntry) =>
  item.anchorType === AnchorType.before || item.anchorType === AnchorType.after

/** breadth-first search to find connected components of pending items. */
function components(items: PlanEntry[], neighbours: Map<string, Set<string>>) {
  const byId = new Map(items.map((item) => [item.id, item]))
  const groups = new Map<string, PlanEntry[]>()
  for (const item of items) {
    if (groups.has(item.id)) continue
    const group: PlanEntry[] = []
    const queue = [item.id]
    groups.set(item.id, group)
    for (let index = 0; index < queue.length; index++) {
      const id = queue[index]
      group.push(byId.get(id)!)
      for (const other of neighbours.get(id) ?? []) {
        if (groups.has(other)) continue
        groups.set(other, group)
        queue.push(other)
      }
    }
  }
  return groups
}

/** Resolve pending items with anchors to their targets, returning the ordered stack and any violations. */
export function resolveAnchors(items: PlanEntry[]) {
  const pending = items.filter((item) => isPending(item.status))
  const byTask = new Map<string, PlanEntry[]>()
  for (const item of items) {
    const occurrences = byTask.get(item.taskId) ?? []
    occurrences.push(item)
    byTask.set(item.taskId, occurrences)
  }
  // pending item -> anchor target
  const targets = new Map<string, PlanEntry>()
  const errors = new Map<string, string>()
  // pending items whose anchors are already satisfied by completed targets
  const satisfied = new Set<string>()
  // anchor target with a pending dependent that must be scheduled before it
  const beforeDependents = new Set<string>()
  // pending tasks with anchors
  const anchorTasks = new Set<string>()
  const neighbours = new Map<string, Set<string>>()
  const adjacentNeighbours = new Map<string, Set<string>>()

  /** Connects two items in a graph, creating the sets if needed. */
  const connect = (graph: Map<string, Set<string>>, a: string, b: string) => {
    if (!graph.has(a)) graph.set(a, new Set())
    if (!graph.has(b)) graph.set(b, new Set())
    graph.get(a)!.add(b)
    graph.get(b)!.add(a)
  }
  for (const item of pending) {
    if (!item.anchorId) continue
    anchorTasks.add(item.anchorId)
    if (item.anchorSatisfied) continue
    const matches = (byTask.get(item.anchorId) ?? []).filter(
      (anchor) =>
        item.anchorSlot === null ||
        anchor.occurrenceId?.endsWith(`:${item.anchorSlot - 1}`),
    )
    if (matches.length !== 1) {
      errors.set(
        item.id,
        `${item.title}: anchor is unavailable or has multiple occurrences`,
      )
      continue
    }
    const target = matches[0]
    targets.set(item.id, target)
    if (isBeforeAnchor(item)) beforeDependents.add(target.id)
    if (!isPending(target.status)) {
      if (isBeforeAnchor(item) || target.status !== 'completed')
        errors.set(item.id, `${item.title}: anchor is unavailable`)
      else satisfied.add(item.id)
      continue
    }
    connect(neighbours, item.id, target.id)
    if (isAdjacent(item)) connect(adjacentNeighbours, item.id, target.id)
  }
  const groups = components(pending, neighbours)
  const adjacentGroups = components(pending, adjacentNeighbours)

  const blocked = new Set<string>()
  const block = (id: string, message: string) => {
    errors.set(id, message)
    for (const item of groups.get(id) ?? []) blocked.add(item.id)
  }
  for (const [id, message] of errors) block(id, message)

  const violations = (ordered: PlanEntry[]) => {
    const positions = new Map(ordered.map((item, index) => [item.id, index]))
    const messages: string[] = []
    for (const item of ordered) {
      if (!item.anchorId || item.anchorSatisfied || !isPending(item.status))
        continue
      if (errors.has(item.id)) {
        messages.push(errors.get(item.id)!)
        continue
      }
      const target = targets.get(item.id)
      const a = positions.get(item.id)!
      const b = target ? positions.get(target.id) : undefined
      // Completed anchors satisfy after constraints without taking a stack position.
      if (target?.status === 'completed' && !isBeforeAnchor(item)) continue
      if (b === undefined) {
        messages.push(`${item.title}: anchor is unavailable`)
        continue
      }
      if (
        (isBeforeAnchor(item) ? a >= b : a <= b) ||
        (isAdjacent(item) && Math.abs(a - b) !== 1)
      )
        messages.push(`${item.title}: ${item.anchorType} anchor constraint`)
      if (
        target &&
        item.fixedStart !== null &&
        target.fixedStart !== null &&
        (isBeforeAnchor(item)
          ? (item.fixedEnd ?? item.fixedStart) > target.fixedStart
          : item.fixedStart < (target.fixedEnd ?? target.fixedStart))
      )
        messages.push(`${item.title}: anchored appointment times conflict`)
    }
    return messages
  }

  /** Collapse immediate chains, then stably sort their before/after dependencies. */
  const order = () => {
    const next = new Map<string, PlanEntry>()
    const previous = new Map<string, PlanEntry>()
    // adjacent anchor/items must be scheduled next to each other, so we collapse them into chains
    for (const item of pending) {
      const target = targets.get(item.id)
      if (!target || !isPending(target.status) || !isAdjacent(item)) continue
      const [a, b] = isBeforeAnchor(item) ? [item, target] : [target, item]
      if (
        (next.has(a.id) && next.get(a.id) !== b) ||
        (previous.has(b.id) && previous.get(b.id) !== a)
      )
        block(item.id, `${item.title}: conflicting adjacent anchor constraints`)
      next.set(a.id, b)
      previous.set(b.id, a)
    }

    const blocks: PlanEntry[][] = []
    const blockOf = new Map<string, number>()
    for (const item of pending) {
      if (previous.has(item.id) || blocked.has(item.id)) continue
      const chain: PlanEntry[] = []
      let member: PlanEntry | undefined = item
      while (member && !blockOf.has(member.id)) {
        blockOf.set(member.id, blocks.length)
        chain.push(member)
        member = next.get(member.id)
      }
      blocks.push(chain)
    }
    for (const item of pending)
      if (!blockOf.has(item.id) && !blocked.has(item.id))
        block(item.id, `${item.title}: cyclic anchor constraints`)
    const successors = blocks.map(() => new Set<number>())
    const incoming = blocks.map(() => 0)
    const rank = new Map(pending.map((item, index) => [item.id, index]))
    const blockRank = blocks.map((block) =>
      Math.min(...block.map((item) => rank.get(item.id)!)),
    )
    for (const item of pending) {
      const target = targets.get(item.id)
      if (!target || !isPending(target.status) || blocked.has(item.id)) continue
      const a = blockOf.get(isBeforeAnchor(item) ? item.id : target.id)!
      const b = blockOf.get(isBeforeAnchor(item) ? target.id : item.id)!
      if (a === b) {
        const chain = blocks[a]
        if (
          isBeforeAnchor(item)
            ? chain.indexOf(item) >= chain.indexOf(target)
            : chain.indexOf(item) <= chain.indexOf(target)
        )
          block(item.id, `${item.title}: conflicting anchor constraints`)
      } else if (!successors[a].has(b)) {
        successors[a].add(b)
        incoming[b]++
      }
    }
    const ready = blocks
      .map((_, index) => index)
      .filter((index) => incoming[index] === 0)
      .sort((a, b) => blockRank[b] - blockRank[a])
    const ordered: PlanEntry[] = []
    const visited = new Set<number>()
    const enqueue = (index: number) => {
      let low = 0,
        high = ready.length
      while (low < high) {
        const middle = (low + high) >>> 1
        if (blockRank[ready[middle]] > blockRank[index]) low = middle + 1
        else high = middle
      }
      ready.splice(low, 0, index)
    }
    while (ready.length) {
      const index = ready.pop()!
      visited.add(index)
      ordered.push(...blocks[index])
      for (const other of successors[index])
        if (--incoming[other] === 0) enqueue(other)
    }
    for (let index = 0; index < blocks.length; index++)
      if (!visited.has(index))
        for (const item of blocks[index])
          block(item.id, `${item.title}: cyclic anchor constraints`)
    return ordered.filter((item) => !blocked.has(item.id))
  }
  const ordered = order()
  return {
    ordered,
    satisfied,
    targets,
    groups,
    adjacentGroups,
    beforeDependents,
    anchorTasks,
    blocked,
    errors,
    violations,
  }
}

export const anchorViolations = (items: PlanEntry[]) =>
  resolveAnchors(items).violations(items)
