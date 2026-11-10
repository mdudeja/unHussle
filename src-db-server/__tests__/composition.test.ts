import { expect, test } from 'bun:test'
import { createBackendRuntime } from '@d/workflows/runtime'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { tasks } from '@d/database/schemas'
import { WorkflowFailure } from '@c/workflows/composition'

test('kernel rejects missing integrity steps, changed bindings, duplicate writes and invalid ordering', () => {
  const runtime = createBackendRuntime(new UnHussleDB(':memory:'))
  const original = runtime.compositions.definition('entity.add')
  for (const mutate of [
    (steps: typeof original.steps) =>
      steps.filter((step) => !step.action?.endsWith('.validateTask')),
    (steps: typeof original.steps) =>
      steps.map((step) =>
        step.action?.endsWith('.trackTaskInterval')
          ? { ...step, input: { from: 'input' as const } }
          : step,
      ),
    (steps: typeof original.steps) => [
      ...steps,
      { ...steps[0], id: 'secondWrite' },
    ],
    (steps: typeof original.steps) => [
      steps[0],
      steps[2],
      steps[1],
      ...steps.slice(3),
    ],
  ]) {
    expect(() =>
      runtime.compositions.replaceCommand({
        ...original,
        steps: mutate(original.steps),
      }),
    ).toThrow()
  }
  runtime.dispose()
})

test('workflow failure preserves previous commits and reports the failing command', async () => {
  const database = new UnHussleDB(':memory:')
  const runtime = createBackendRuntime(database)
  const db = await database.getDb()
  const events: string[] = []
  runtime.events.onAny((name) => {
    events.push(name)
  })
  try {
    await runtime.workflows.execute([
      {
        id: 'first',
        command: 'entity.add',
        input: {
          kind: 'tasks',
          action: 'create',
          changes: { title: 'Committed' },
        },
      },
      {
        id: 'invalid',
        command: 'entity.add',
        input: {
          kind: 'tasks',
          action: 'create',
          changes: {
            title: 'Rolled back',
            scheduled_start: 2000,
            scheduled_end: 1000,
          },
        },
      },
      {
        id: 'never',
        command: 'entity.add',
        input: {
          kind: 'tasks',
          action: 'create',
          changes: { title: 'Never runs' },
        },
      },
    ])
    throw new Error('Expected workflow failure')
  } catch (error) {
    expect(error).toBeInstanceOf(WorkflowFailure)
    expect((error as WorkflowFailure).completed.map((step) => step.id)).toEqual(
      ['first'],
    )
    expect((error as WorkflowFailure).failedStep).toBe('invalid')
  }
  expect(
    db
      .select()
      .from(tasks)
      .all()
      .map((task) => task.title),
  ).toEqual(['Committed'])
  expect(events.filter((name) => name === 'tasks.add')).toEqual(['tasks.add'])
  runtime.dispose()
})
