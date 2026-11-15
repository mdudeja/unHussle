/** An extension as the dependency graph sees it. */
export type DependencyNode = { id: string; requires?: string[] }

const requiresOf = (nodes: DependencyNode[], id: string) =>
  nodes.find((node) => node.id === id)?.requires ?? []

/**
 * Why an extension's requirements can't be met: it needs itself, an ID that
 * isn't installed, sits in a cycle, or needs one of those.
 */
export function dependencyIssues(nodes: DependencyNode[]) {
  const ids = new Set(nodes.map(({ id }) => id))
  const issues = new Map<string, string>()
  for (const { id, requires = [] } of nodes) {
    if (requires.includes(id)) issues.set(id, "An extension can't need itself")
    const missing = requires.find((required) => !ids.has(required))
    if (missing) issues.set(id, `Needs "${missing}", which isn't installed`)
  }

  const done = new Set<string>()
  const path: string[] = []
  const visit = (id: string) => {
    if (done.has(id) || issues.has(id)) return
    const start = path.indexOf(id)
    if (start >= 0) {
      const cycle = [...path.slice(start), id]
      const text = `Dependency cycle: ${cycle.join(' -> ')}`
      for (const member of cycle) issues.set(member, text)
      return
    }
    path.push(id)
    for (const required of requiresOf(nodes, id)) visit(required)
    path.pop()
    done.add(id)
  }
  for (const { id } of nodes) visit(id)

  // Anything that needs a broken extension can't load either.
  let changed = true
  while (changed) {
    changed = false
    for (const { id, requires = [] } of nodes) {
      const broken = requires.find((required) => issues.has(required))
      if (!issues.has(id) && broken) {
        issues.set(id, `Needs "${broken}", which can't load`)
        changed = true
      }
    }
  }
  return issues
}

/** Items with each one after what it needs; otherwise in their given order. */
export function sortByDependencies<T>(
  items: T[],
  nodeOf: (item: T) => DependencyNode | undefined,
) {
  const sorted: T[] = []
  const seen = new Set<T>()
  const visit = (item: T) => {
    if (seen.has(item)) return
    seen.add(item)
    for (const required of nodeOf(item)?.requires ?? []) {
      const found = items.find((other) => nodeOf(other)?.id === required)
      if (found) visit(found)
    }
    sorted.push(item)
  }
  for (const item of items) visit(item)
  return sorted
}

const closure = (
  nodes: DependencyNode[],
  id: string,
  next: (id: string) => string[],
) => {
  const found = new Set<string>()
  const visit = (current: string) => {
    for (const other of next(current))
      if (!found.has(other) && other !== id) {
        found.add(other)
        visit(other)
      }
  }
  visit(id)
  const ordered = sortByDependencies(nodes, (node) => node).map(
    ({ id }) => id,
  )
  return ordered.filter((other) => found.has(other))
}

/** What an extension needs, directly or through others, needed ones first. */
export const requirementsOf = (nodes: DependencyNode[], id: string) =>
  closure(nodes, id, (current) => requiresOf(nodes, current))

/** Extensions that need this one, directly or through others, in start order. */
export const dependentsOf = (nodes: DependencyNode[], id: string) =>
  closure(nodes, id, (current) =>
    nodes
      .filter(({ requires = [] }) => requires.includes(current))
      .map(({ id }) => id),
  )
