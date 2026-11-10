import { describe, expect, test } from 'bun:test'
import { createRuntime } from '@c/workflows/runtime'
import { createTelemetry, serializeError } from '@c/workflows/telemetry'

/** Creates a runtime instance paired with telemetry for backend use. */
const make = (telemetry = createTelemetry({ side: 'backend' })) => {
  const runtime = createRuntime<
    {
      save: { input: { operationId?: string; value: number }; result: number }
      outer: { input: number; result: number }
    },
    { saved: number },
    object
  >({}, { telemetry })
  return { runtime, telemetry }
}

describe('Telemetry', () => {
  test('commands, nested commands, events and listeners form one trace', async () => {
    const { runtime, telemetry } = make()
    runtime.commands.handle(
      'save',
      async (_name, { value }, _context, trace) => {
        await runtime.events.publish('saved', value, {
          traceId: trace?.traceId,
          parentId: trace?.spanId,
        })
        return value
      },
    )
    runtime.commands.handle('outer', (_name, value, _context, trace) =>
      runtime.commands.execute(
        'save',
        { value },
        { traceId: trace?.traceId, parentId: trace?.spanId },
      ),
    )
    runtime.events.on('saved', () => {}, { label: 'recorder' })
    runtime.events.onAny(function forwarder() {})

    await runtime.commands.execute('outer', 1)
    const spans = telemetry.recent()
    const byName = Object.fromEntries(spans.map((span) => [span.name, span]))

    expect(new Set(spans.map((span) => span.traceId)).size).toBe(1)
    expect(byName.outer.parentId).toBeUndefined()
    expect(byName.save.parentId).toBe(byName.outer.spanId)
    expect(byName.saved).toMatchObject({
      kind: 'event',
      parentId: byName.save.spanId,
      attrs: { listeners: 2 },
    })
    expect(byName.recorder.parentId).toBe(byName.saved.spanId)
    expect(byName.forwarder.kind).toBe('listener')
    expect(spans.every((span) => span.status === 'ok')).toBe(true)
  })

  test('the operationId of the input becomes the trace id', async () => {
    const { runtime, telemetry } = make()
    runtime.commands.handle('save', (_name, { value }) => value)
    await runtime.commands.execute('save', { operationId: 'op-1', value: 1 })
    expect(telemetry.recent()[0].traceId).toBe('op-1')
  })

  test('errors keep their stack; a failing listener marks its own span only', async () => {
    const { runtime, telemetry } = make()
    runtime.commands.handle('save', () => {
      throw new TypeError('Invalid input')
    })
    await expect(
      runtime.commands.execute('save', { value: 0 }),
    ).rejects.toThrow('Invalid input')
    const [command] = telemetry.recent({ kind: 'command' })
    expect(command.status).toBe('error')
    expect(command.error).toMatchObject({
      name: 'TypeError',
      message: 'Invalid input',
    })
    expect(command.error?.stack).toContain('Invalid input')

    runtime.events.on(
      'saved',
      () => {
        throw new Error('Listener failed')
      },
      { label: 'broken' },
    )
    runtime.events.on('saved', () => {}, { label: 'healthy' })
    await runtime.events.publish('saved', 1)
    const listeners = telemetry.recent({ kind: 'listener' })
    expect(listeners.map((span) => [span.name, span.status])).toEqual([
      ['broken', 'error'],
      ['healthy', 'ok'],
    ])
    expect(telemetry.recent({ kind: 'event' })[0]).toMatchObject({
      status: 'ok',
      attrs: { failed: 1 },
    })
  })

  test('a throwing sink or subscriber cannot break execute or publish', async () => {
    const telemetry = createTelemetry({
      side: 'frontend',
      sinks: [
        () => {
          throw new Error('Sink failed')
        },
      ],
    })
    telemetry.subscribe(() => {
      throw new Error('Subscriber failed')
    })
    const { runtime } = make(telemetry)
    runtime.commands.handle('save', (_name, { value }) => value + 1)
    expect(await runtime.commands.execute('save', { value: 1 })).toBe(2)
    runtime.events.on('saved', () => {})
    expect(
      (await runtime.events.publish('saved', 1)).map(({ status }) => status),
    ).toEqual(['fulfilled'])
    expect(telemetry.recent()).toHaveLength(3)
  })

  test('the ring buffer is bounded and filterable', () => {
    const telemetry = createTelemetry({ side: 'backend', bufferSize: 3 })
    for (let index = 0; index < 5; index++)
      telemetry.signal(`signal-${index}`, undefined, { traceId: `t${index}` })
    expect(telemetry.recent().map((span) => span.name)).toEqual([
      'signal-2',
      'signal-3',
      'signal-4',
    ])
    expect(telemetry.recent({ traceId: 't3' })).toHaveLength(1)
    expect(telemetry.recent({ limit: 1 })[0].name).toBe('signal-4')
    expect(telemetry.recent({ kind: 'command' })).toEqual([])
  })

  test('synchronous work stays synchronous', () => {
    const telemetry = createTelemetry({ side: 'backend' })
    const result = telemetry.span('action', 'sync', (span) => {
      span.setAttrs({ rows: 2 })
      return 2
    })
    expect(result).toBe(2)
    expect(telemetry.recent()[0]).toMatchObject({
      kind: 'action',
      attrs: { rows: 2 },
    })
    expect(() =>
      telemetry.span('action', 'throws', () => {
        throw new Error('Sync failure')
      }),
    ).toThrow('Sync failure')
    expect(telemetry.recent({ status: 'error' })[0].name).toBe('throws')
  })

  test('runtimes without telemetry pass no trace to handlers', async () => {
    const runtime = createRuntime<
      { save: { input: number; result: boolean } },
      object,
      object
    >({})
    runtime.commands.handle(
      'save',
      (_name, _input, _context, trace) => trace === undefined,
    )
    expect(await runtime.commands.execute('save', 1)).toBe(true)
  })

  test('serializeError handles non-errors', () => {
    expect(serializeError('plain')).toEqual({ name: 'Error', message: 'plain' })
    expect(serializeError({ code: 1 })).toEqual({
      name: 'Error',
      message: '{"code":1}',
    })
  })
})
