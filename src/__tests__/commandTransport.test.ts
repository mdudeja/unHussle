import { expect, mock, test } from 'bun:test'
import { createCommandTransport } from '@/workflows/commandTransport'
import { createTelemetry } from '@c/workflows/telemetry'

/** Creates a command transport configured for tests with a no-op transport and frontend telemetry. */
function fixture() {
  return createCommandTransport({
    transport: {
      connect: () => {},
      ready: () => Promise.resolve(),
      close: () => {},
    },
    telemetry: createTelemetry({ side: 'frontend' }),
    eventTimeoutMs: 10,
    readyTimeoutMs: 10,
  })
}

test('events that arrive before the HTTP response settle without recovery', async () => {
  const transport = fixture()
  const recover = mock(async () => {})
  const result = await transport.send({
    command: 'entity.add',
    expectedEvents: ['entity.add', 'tasks.add'],
    recover,
    request: async ({ operationId }) => {
      transport.handled(operationId, 'entity.add')
      transport.handled(operationId, 'tasks.add')
      return 'saved'
    },
  })
  expect(result.result).toBe('saved')
  expect(recover).not.toHaveBeenCalled()
  transport.dispose()
})

test('all command families share missing-event recovery and never repeat a write', async () => {
  for (const command of [
    'entity.add',
    'scheduler.generate',
    'resource.content.save',
  ]) {
    const transport = fixture()
    const recover = mock(async () => {})
    const request = mock(async () => 'committed')
    expect(
      (
        await transport.send({
          command,
          expectedEvents: ['missing'],
          request,
          recover,
        })
      ).result,
    ).toBe('committed')
    expect(request).toHaveBeenCalledTimes(1)
    expect(recover).toHaveBeenCalledTimes(1)
    transport.dispose()
  }
})

test('failed writes clean up without recovery, and later writes still settle', async () => {
  const transport = fixture()
  const recover = mock(async () => {})
  await expect(
    transport.send({
      command: 'entity.add',
      expectedEvents: ['entity.add'],
      recover,
      request: async () => {
        throw new Error('write failed')
      },
    }),
  ).rejects.toThrow('write failed')
  expect(recover).not.toHaveBeenCalled()
  expect(
    (
      await transport.send({
        command: 'entity.add',
        expectedEvents: ['entity.add'],
        recover,
        request: async ({ operationId }) => {
          transport.handled(operationId, 'entity.add')
          return 'saved'
        },
      })
    ).result,
  ).toBe('saved')
  transport.dispose()
  const request = mock(async () => 'unexpected')
  await expect(
    transport.send({
      command: 'entity.add',
      expectedEvents: [],
      request,
      recover,
    }),
  ).rejects.toThrow('disposed')
  expect(request).not.toHaveBeenCalled()
})
