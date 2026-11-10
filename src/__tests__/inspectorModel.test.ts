import { describe, expect, test } from 'bun:test'
import type { Span } from '@c/workflows/telemetry'
import {
  groupTraces,
  mergeSpans,
  percentile,
  signalCounts,
  summarize,
  waterfall,
} from '@/components/dev/inspectorModel'

/** Creates a span with default tracing metadata. */
const span = (values: Partial<Span> & Pick<Span, 'spanId'>): Span => ({
  traceId: 't1',
  kind: 'command',
  name: 'entity.add',
  side: 'frontend',
  start: 0,
  durationMs: 10,
  status: 'ok',
  ...values,
})

describe('Workflow inspector model', () => {
  const spans = [
    span({ spanId: 'command', start: 100, durationMs: 50 }),
    span({
      spanId: 'backend',
      parentId: 'http',
      side: 'backend',
      start: 110,
      durationMs: 20,
    }),
    span({ spanId: 'http', parentId: 'command', kind: 'http', start: 105 }),
    span({
      spanId: 'reaction',
      parentId: 'command',
      kind: 'reaction',
      name: 'upsertRows',
      start: 140,
      status: 'error',
    }),
    span({ spanId: 'other', traceId: 't2', kind: 'signal', start: 300 }),
  ]

  test('traces group by id, newest first, rooted at the earliest parentless span', () => {
    const [newest, first] = groupTraces(spans)
    expect(newest.traceId).toBe('t2')
    expect(first).toMatchObject({
      root: { spanId: 'command' },
      start: 100,
      durationMs: 50,
      errors: 1,
    })
  })

  test('the waterfall nests the backend half under the request that sent it', () => {
    expect(
      waterfall(spans.filter((s) => s.traceId === 't1')).map(
        ({ span, depth, offsetMs }) => [span.spanId, depth, offsetMs],
      ),
    ).toEqual([
      ['command', 0, 0],
      ['http', 1, 5],
      ['backend', 2, 10],
      ['reaction', 1, 40],
    ])
  })

  test('summaries, signals and merging', () => {
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2)
    expect(percentile([], 0.95)).toBe(0)
    expect(summarize(spans, ['reaction'])).toEqual([
      {
        kind: 'reaction',
        name: 'upsertRows',
        count: 1,
        errors: 1,
        p50: 10,
        p95: 10,
      },
    ])
    expect(signalCounts(spans)).toEqual([['entity.add', 1]])
    expect(mergeSpans(spans, spans)).toHaveLength(spans.length)
  })
})
