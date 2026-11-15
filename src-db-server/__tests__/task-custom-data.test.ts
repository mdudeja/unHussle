import { expect, test } from 'bun:test'
import { Value } from '@sinclair/typebox/value'
import { createBackendRuntime } from '@d/bootstrap'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { insertTaskSchema, updateTaskSchema } from '@d/database/validation'
import type { EntryRecord } from '@c/workflows/contracts'

test('the task schema only accepts a JSON object or null as custom data', () => {
  for (const custom_data of [{ stage: 'Review' }, null])
    expect(Value.Check(updateTaskSchema, { custom_data })).toBe(true)
  for (const custom_data of [['Review'], 'Review', 1])
    expect(Value.Check(updateTaskSchema, { custom_data })).toBe(false)
  expect(Value.Check(insertTaskSchema, { title: 'No custom data' })).toBe(true)
})

test('the domain refuses custom data that is not an object', async () => {
  const runtime = createBackendRuntime(new UnHussleDB(':memory:'))
  const change = (custom_data: unknown) =>
    runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id: task.id,
      changes: { custom_data },
    })
  const task = (await runtime.commands.execute('entity.add', {
    kind: 'tasks',
    action: 'create',
    changes: { title: 'Card' },
  })) as EntryRecord
  expect(await change({ stage: 'Review' })).toMatchObject({
    custom_data: { stage: 'Review' },
  })
  await expect(change(['Review'])).rejects.toThrow('must be a JSON object')
  await expect(change('Review')).rejects.toThrow('must be a JSON object')
  runtime.dispose()
})
