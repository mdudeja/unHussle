import { describe, expect, test } from 'bun:test'
import { Type } from '@sinclair/typebox'
import {
  createCompositionRegistry,
  WorkflowFailure,
  type CommandDefinition,
} from '@c/workflows/composition'

const number = Type.Number()
/** Defines a command that doubles a number by applying two increment steps. */
const definition = (id = 'test.double'): CommandDefinition => ({
  id,
  description: 'Double',
  input: number,
  output: number,
  steps: [
    { id: 'first', action: 'test.increment', input: { from: 'input' } },
    {
      id: 'second',
      action: 'test.increment',
      input: { from: 'step', step: 'first' },
    },
  ],
  result: { from: 'step', step: 'second' },
})
/** Creates a composition registry configured with a test increment action. */
const setup = () => {
  const registry = createCompositionRegistry<string[]>()
  registry.registerAction({
    id: 'test.increment',
    description: 'Increment',
    input: number,
    output: number,
    run: (input, log) => {
      log.push('increment')
      return (input as number) + 1
    },
  })
  return registry
}

describe('compiled command definitions', () => {
  test('binds outputs, caches isolated definitions, and inlines commands', () => {
    const registry = setup()
    const original = definition()
    registry.registerCommand(original)
    original.steps.length = 0
    const parent = definition('test.parent')
    parent.steps = [
      { id: 'child', command: 'test.double', input: { from: 'input' } },
    ]
    parent.result = { from: 'step', step: 'child' }
    registry.registerCommand(parent)
    const log: string[] = []
    expect(registry.execute('test.parent', 2, log)).toBe(4)
    expect(log).toEqual(['increment', 'increment'])
    expect(() => registry.execute('test.parent', 'bad', [])).toThrow('input')
  })
  test('loads serialized schemas and bindings without executable definitions', () => {
    const registry = setup()
    registry.registerCommand(
      JSON.parse(JSON.stringify(definition())) as CommandDefinition,
    )
    expect(registry.execute('test.double', 3, [])).toBe(5)
  })
  test('rejects missing actions, duplicate IDs, forward paths, incompatible bindings and invalid result', () => {
    for (const change of [
      (d: CommandDefinition) => {
        d.steps[0].action = 'test.absent'
      },
      (d: CommandDefinition) => {
        d.steps[1].id = 'first'
      },
      (d: CommandDefinition) => {
        d.steps[0].input = { from: 'step', step: 'second' }
      },
      (d: CommandDefinition) => {
        d.steps[0].input = { from: 'input', path: ['missing'] }
      },
      (d: CommandDefinition) => {
        d.steps[0].input = { from: 'literal', value: 'wrong' }
      },
      (d: CommandDefinition) => {
        d.result = { from: 'literal', value: false }
      },
    ]) {
      const registry = setup()
      const d = definition()
      change(d)
      expect(() => registry.registerCommand(d)).toThrow()
      registry.registerCommand(definition()) // failed registration leaves no residue
    }
  })
  test('rejects recursive replacements and retains the last valid plan', () => {
    const registry = setup()
    registry.registerCommand(definition())
    const recursive = definition()
    recursive.steps = [
      { id: 'self', command: recursive.id, input: { from: 'input' } },
    ]
    recursive.result = { from: 'step', step: 'self' }
    expect(() => registry.replaceCommand(recursive)).toThrow('Recursive')
    expect(registry.execute('test.double', 0, [])).toBe(2)
  })
  test('enforces required order without rearranging requested steps', () => {
    const registry = setup()
    registry.registerAction({
      id: 'test.other',
      description: 'Other',
      input: number,
      output: number,
      run: (value) => value,
    })
    const d = definition()
    d.steps[1].action = 'test.other'
    registry.registerCommand(d, { required: ['test.increment', 'test.other'] })
    const reversed = definition()
    reversed.steps[0].action = 'test.other'
    expect(() => registry.replaceCommand(reversed)).toThrow('requires')
    const missing = definition()
    expect(() => registry.replaceCommand(missing)).toThrow('requires')
  })
  test('rejects asynchronous atomic actions and validates action output', () => {
    for (const run of [() => Promise.resolve(1), () => 'wrong']) {
      const registry = createCompositionRegistry<undefined>()
      registry.registerAction({
        id: 'test.increment',
        description: 'Bad',
        input: number,
        output: number,
        run,
      })
      registry.registerCommand(definition())
      expect(() => registry.execute('test.double', 1, undefined)).toThrow()
    }
  })
  test('reports committed workflow steps and stops without retrying', async () => {
    const calls: string[] = []
    try {
      const registry = createCompositionRegistry<undefined>()
      for (const id of ['one', 'two', 'three']) {
        registry.registerAction({
          id: `test.action.${id}`,
          description: id,
          input: number,
          output: number,
          run: () => {
            calls.push(`test.${id}`)
            if (id === 'two') throw new Error('failed')
            return 2
          },
        })
        registry.registerCommand({
          id: `test.${id}`,
          description: id,
          input: number,
          output: number,
          steps: [
            {
              id: 'action',
              action: `test.action.${id}`,
              input: { from: 'input' },
            },
          ],
          result: { from: 'step', step: 'action' },
        })
      }
      registry.registerCommand({
        id: 'test.workflow',
        description: 'Sequential commands',
        execution: 'workflow',
        input: number,
        output: number,
        steps: ['one', 'two', 'three'].map((id) => ({
          id,
          command: `test.${id}`,
          input: { from: 'input' },
        })),
        result: { from: 'step', step: 'three' },
      })
      await registry.executeAsync('test.workflow', 1, undefined)
      throw new Error('Expected failure')
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowFailure)
      expect((error as WorkflowFailure).completed).toEqual([
        { id: 'one', result: 2 },
      ])
      expect((error as WorkflowFailure).failedStep).toBe('two')
      expect(calls).toEqual(['test.one', 'test.two'])
    }
  })
})

test('optional output paths cannot satisfy required inputs during compilation', () => {
  const registry = createCompositionRegistry<undefined>()
  registry.registerAction({
    id: 'test.required',
    description: 'Needs a string',
    input: Type.String(),
    output: Type.String(),
    run: (value) => value,
  })
  expect(() =>
    registry.registerCommand({
      id: 'test.optional',
      description: 'Invalid optional binding',
      input: Type.Object({ value: Type.Optional(Type.String()) }),
      output: Type.String(),
      steps: [
        {
          id: 'read',
          action: 'test.required',
          input: { from: 'input', path: ['value'] },
        },
      ],
      result: { from: 'step', step: 'read' },
    }),
  ).toThrow('Incompatible')
})

test('serialized schemas cannot silently turn unsupported references into unknown values', () => {
  const registry = createCompositionRegistry<undefined>()
  const input = JSON.parse('{"$ref":"missing"}') as ReturnType<
    typeof Type.String
  >
  expect(() =>
    registry.registerAction({
      id: 'test.unsupportedSchema',
      description: 'Unsupported reference',
      input,
      output: Type.Null(),
      run: () => null,
    }),
  ).toThrow('Unsupported serialized schema')
})

test('cached atomic plans inline compatible commands and workflows invoke each boundary once', async () => {
  const registry = setup()
  let commits = 0
  const boundary = {
    id: 'test.atomic',
    run: async (
      _input: unknown,
      context: string[],
      execute: (context: string[]) => unknown,
    ) => {
      const result = execute(context)
      commits++
      return result
    },
  }
  registry.registerCommand(definition(), undefined, boundary)
  registry.registerCommand(
    {
      id: 'test.inline',
      description: 'Inline',
      input: number,
      output: number,
      steps: [
        { id: 'child', command: 'test.double', input: { from: 'input' } },
      ],
      result: { from: 'step', step: 'child' },
    },
    undefined,
    boundary,
  )
  registry.registerCommand({
    id: 'test.workflow',
    description: 'Independent commits',
    execution: 'workflow',
    input: number,
    output: number,
    steps: [
      { id: 'first', command: 'test.inline', input: { from: 'input' } },
      {
        id: 'second',
        command: 'test.double',
        input: { from: 'step', step: 'first' },
      },
    ],
    result: { from: 'step', step: 'second' },
  })
  expect(await registry.executeAsync('test.workflow', 1, [])).toBe(5)
  expect(commits).toBe(2)
  await expect(
    registry.executeAsync('test.inline', 'invalid', []),
  ).rejects.toThrow('input')
  expect(commits).toBe(2)
})
