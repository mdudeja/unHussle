import { describe, expect, test } from 'bun:test'
import { createRuntime } from '@c/workflows/runtime'

describe('Workflow runtime', () => {
  const make = () =>
    createRuntime<
      {
        save: { input: number; result: number }
      },
      { saved: number },
      { offset: number }
    >({ offset: 2 })

  test('commands have one owner, typed results, and injected context', async () => {
    const runtime = make()
    expect(await runtime.commands.execute('save', 1)).rejects.toThrow(
      'No handler',
    )
    const unregister = runtime.commands.handle(
      'save',
      (value, { offset }) => value + offset,
    )
    expect(() => runtime.commands.handle('save', () => 0)).toThrow(
      'Duplicate command',
    )
    expect(await runtime.commands.execute('save', 3)).toBe(5)
    unregister()
    expect(await runtime.commands.execute('save', 1)).rejects.toThrow(
      'No handler',
    )
  })

  test('required steps stop on failure; completion listeners are isolated', async () => {
    const runtime = make()
    const steps: string[] = []
    runtime.commands.handle('save', () => {
      steps.push('validate')
      throw new Error('Invalid input')
    })
    expect(await runtime.commands.execute('save', 0)).rejects.toThrow(
      'Invalid input',
    )
    expect(steps).toEqual(['validate'])
    runtime.events.on('saved', () => {
      throw new Error('Listener failed')
    })
    const off = runtime.events.on('saved', (value, { offset }) => {
      steps.push(String(value + offset))
    })
    expect(
      (await runtime.events.publish('saved', 3)).map((result) => result.status),
    ).toEqual(['rejected', 'fulfilled'])
    expect(steps).toEqual(['validate', '5'])
    off()
    expect(await runtime.events.publish('saved', 3)).toHaveLength(1)
    runtime.dispose()
    expect(await runtime.events.publish('saved', 3)).toEqual([])
    expect(await runtime.commands.execute('save', 0)).rejects.toThrow(
      'No handler',
    )
  })
})
