import type { Span, SpanKind } from '@c/workflows/telemetry'

export type TraceSummary = {
  traceId: string
  root: Span
  start: number
  durationMs: number
  spans: Span[]
  errors: number
}

export type WaterfallRow = { span: Span; depth: number; offsetMs: number }

export type SpanStats = {
  kind: SpanKind
  name: string
  count: number
  errors: number
  p50: number
  p95: number
}

/** Computes the end time of a span. */
const end = (span: Span) => span.start + span.durationMs

/** Frontend and backend halves can overlap when fetched more than once. */
export const mergeSpans = (...groups: Span[][]) => {
  const byId = new Map<string, Span>()
  for (const group of groups)
    for (const span of group) byId.set(span.spanId, span)
  return [...byId.values()]
}

/** Finds the root span among a collection of spans, treating spans with no parent or a missing parent as roots and selecting the earliest-starting one. */
const rootOf = (spans: Span[]) => {
  const ids = new Set(spans.map((span) => span.spanId))
  const roots = spans.filter(
    (span) => !span.parentId || !ids.has(span.parentId),
  )
  return (roots.length ? roots : spans).reduce((first, span) =>
    span.start < first.start ? span : first,
  )
}

/** Groups spans by trace, newest first. */
export function groupTraces(spans: Span[]): TraceSummary[] {
  const byTrace = new Map<string, Span[]>()
  for (const span of spans) {
    const group = byTrace.get(span.traceId) ?? []
    group.push(span)
    byTrace.set(span.traceId, group)
  }
  return [...byTrace.entries()]
    .map(([traceId, group]) => {
      const start = Math.min(...group.map((span) => span.start))
      return {
        traceId,
        root: rootOf(group),
        start,
        durationMs: Math.max(...group.map(end)) - start,
        spans: group,
        errors: group.filter((span) => span.status === 'error').length,
      }
    })
    .sort((a, b) => b.start - a.start)
}

/** Depth-first by parent, children in start order, offsets from the trace start. */
export function waterfall(spans: Span[]): WaterfallRow[] {
  if (!spans.length) return []
  const ids = new Set(spans.map((span) => span.spanId))
  const children = new Map<string | undefined, Span[]>()
  for (const span of spans) {
    const parent =
      span.parentId && ids.has(span.parentId) ? span.parentId : undefined
    const group = children.get(parent) ?? []
    group.push(span)
    children.set(parent, group)
  }
  for (const group of children.values()) group.sort((a, b) => a.start - b.start)

  const t0 = Math.min(...spans.map((span) => span.start))
  const rows: WaterfallRow[] = []
  /** Recursively traverses the span tree to build a flattened, depth-annotated list of spans for display. */
  const visit = (parent: string | undefined, depth: number) => {
    for (const span of children.get(parent) ?? []) {
      rows.push({ span, depth, offsetMs: span.start - t0 })
      visit(span.spanId, depth + 1)
    }
  }
  visit(undefined, 0)
  return rows
}

/** Computes the percentile value from a sorted numeric array. */
export const percentile = (sorted: number[], p: number) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)]
    : 0

/** Count, error count and latency percentiles per kind and name. */
export function summarize(spans: Span[], kinds: SpanKind[]): SpanStats[] {
  const groups = new Map<string, Span[]>()
  for (const span of spans) {
    if (!kinds.includes(span.kind)) continue
    const key = `${span.side}:${span.kind}:${span.name}`
    const group = groups.get(key) ?? []
    group.push(span)
    groups.set(key, group)
  }
  return [...groups.values()]
    .map((group) => {
      const durations = group
        .map((span) => span.durationMs)
        .sort((a, b) => a - b)
      return {
        kind: group[0].kind,
        name: `${group[0].side === 'backend' ? 'backend ' : ''}${group[0].name}`,
        count: group.length,
        errors: group.filter((span) => span.status === 'error').length,
        p50: percentile(durations, 0.5),
        p95: percentile(durations, 0.95),
      }
    })
    .sort((a, b) => b.count - a.count)
}

/** How often each health signal fired. */
export function signalCounts(spans: Span[]) {
  const counts = new Map<string, number>()
  for (const span of spans)
    if (span.kind === 'signal' || span.kind === 'error')
      counts.set(span.name, (counts.get(span.name) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}
