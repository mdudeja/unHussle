import { describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { getDateTimeMillis } from '@c/datetimeUtils'
import { ProgressInput, ProgressStatus } from '@c/types/enums'
import type { RecordedProgressSession } from '@c/scheduler/contracts'
import { createBackendRuntime } from '@d/bootstrap'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { goals, progressSessions, projects } from '@d/database/schemas'

const date = '2026-11-02'
const timezone = 'UTC'

async function fixture() {
  const database = new UnHussleDB(':memory:')
  const db = await database.getDb()
  let now = getDateTimeMillis(date, '07:00', timezone)
  const runtime = createBackendRuntime(database, { now: () => now })
  const recorded: RecordedProgressSession[] = []
  runtime.events.on('scheduler.progress.recorded', (_name, event) => {
    recorded.push(...event.sessions)
  })
  const add = async (
    kind: 'tasks' | 'projects' | 'goals',
    changes: Record<string, unknown>,
  ) => {
    const row = await runtime.commands.execute(
      kind === 'tasks' ? 'entity.add' : 'entityCollection.add',
      { kind, action: 'create', changes },
    )
    if (!row || Array.isArray(row)) throw new Error(`${kind} was not created`)
    return row.id
  }
  const change = (
    kind: 'tasks' | 'projects' | 'goals',
    id: string,
    changes: Record<string, unknown>,
  ) =>
    runtime.commands.execute(
      kind === 'tasks' ? 'entity.change' : 'entityCollection.change',
      { kind, action: 'update', id, changes },
    )
  const book = (title: string, changes: Record<string, unknown> = {}) =>
    add('projects', {
      title,
      progress_total: 350,
      progress_unit: 'pages',
      progress_input: ProgressInput.POSITION,
      ...changes,
    })
  const monthlyGoal = () =>
    add('goals', {
      title: 'Read 1000 pages',
      progress_total: 1000,
      progress_unit: 'pages',
      progress_input: ProgressInput.AMOUNT,
    })
  const sessions = () => db.select().from(progressSessions).all()
  const log = (values: { sessionId: string; value: number }[]) =>
    runtime.commands.execute('scheduler.progress.log', { values })
  return {
    db,
    runtime,
    recorded,
    add,
    change,
    book,
    monthlyGoal,
    sessions,
    log,
    advance: (minutes: number) => {
      now += minutes * 60000
    },
  }
}

describe('count progress', () => {
  test('the count fields must fit together', async () => {
    const f = await fixture()
    await expect(
      f.add('projects', { title: 'No unit', progress_total: 10 }),
    ).rejects.toThrow('Add a unit')
    await expect(
      f.add('goals', { title: 'No total', progress_done: 5 }),
    ).rejects.toThrow('Add a total')
    const id = await f.book('Dune')
    await expect(
      f.change('projects', id, { progress_done: 351 }),
    ).rejects.toThrow("can't pass the total")
    f.runtime.dispose()
  })

  test('a completed task feeds its counting project and that project’s goal', async () => {
    const f = await fixture()
    const goalId = await f.monthlyGoal()
    const projectId = await f.book('Dune', { goal_id: goalId })
    const taskId = await f.add('tasks', {
      title: 'Chapter 1',
      project_id: projectId,
    })
    await f.change('tasks', taskId, { status: ProgressStatus.IN_PROGRESS })
    f.advance(25)
    await f.change('tasks', taskId, { status: ProgressStatus.COMPLETED })

    expect(f.recorded.map(({ kind, itemId }) => [kind, itemId])).toEqual([
      ['projects', projectId],
      ['goals', goalId],
    ])
    expect(
      f.sessions().map(({ minutes, amount }) => [minutes, amount]),
    ).toEqual([
      [25, null],
      [25, null],
    ])
    // Completing again doesn't record the same work twice.
    await f.change('tasks', taskId, { status: ProgressStatus.PLANNED })
    await f.change('tasks', taskId, { status: ProgressStatus.COMPLETED })
    expect(f.sessions()).toHaveLength(2)
    f.runtime.dispose()
  })

  test('a task in a project that doesn’t count records nothing', async () => {
    const f = await fixture()
    const projectId = await f.add('projects', { title: 'Garden' })
    const taskId = await f.add('tasks', {
      title: 'Weed',
      project_id: projectId,
    })
    await f.change('tasks', taskId, { status: ProgressStatus.COMPLETED })
    expect(f.sessions()).toHaveLength(0)
    f.runtime.dispose()
  })

  test('an occurrence of a habit task linked to a goal records its minutes', async () => {
    const f = await fixture()
    const goalId = await f.monthlyGoal()
    await f.add('tasks', {
      title: 'Read',
      goal_id: goalId,
      estimated_minutes: 30,
      tags: [{ title: 'work' }],
      is_recurring: true,
      recurrance_rule: { type: 'daily', data: {} },
    })
    const plan = await f.runtime.commands.execute('scheduler.generate', {
      date,
      timezone,
    })
    const occurrence = plan.entries[0].id
    await f.runtime.commands.execute('scheduler.occurrence.transition', {
      id: occurrence,
      status: ProgressStatus.IN_PROGRESS,
    })
    f.advance(20)
    await f.runtime.commands.execute('scheduler.occurrence.transition', {
      id: occurrence,
      status: ProgressStatus.COMPLETED,
    })
    const [session] = f.sessions()
    expect(session).toMatchObject({
      goal_id: goalId,
      minutes: 20,
      amount: null,
    })

    await f.log([{ sessionId: session.id, value: 30 }])
    const goal = f.db.select().from(goals).where(eq(goals.id, goalId)).get()
    expect(goal?.progress_done).toBe(30)
    expect(f.sessions()[0].amount).toBe(30)
    await expect(f.log([{ sessionId: session.id, value: 5 }])).rejects.toThrow(
      'already recorded',
    )
    f.runtime.dispose()
  })

  test('logging a position stores the units added and respects the total', async () => {
    const f = await fixture()
    const projectId = await f.book('Dune', { progress_done: 120 })
    const first = await f.add('tasks', { title: 'Read', project_id: projectId })
    const second = await f.add('tasks', {
      title: 'Read more',
      project_id: projectId,
    })
    for (const id of [first, second])
      await f.change('tasks', id, { status: ProgressStatus.COMPLETED })
    const [a, b] = f.sessions()

    await expect(f.log([{ sessionId: a.id, value: 400 }])).rejects.toThrow(
      "can't pass the total",
    )
    await f.log([{ sessionId: a.id, value: 170 }])
    // A position may go back, to undo a mistake.
    await f.log([{ sessionId: b.id, value: 160 }])
    const book = f.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get()
    expect(book?.progress_done).toBe(160)
    expect(f.sessions().map(({ amount }) => amount)).toEqual([50, -10])
    f.runtime.dispose()
  })

  test('deleting an item deletes its sessions', async () => {
    const f = await fixture()
    const projectId = await f.book('Dune')
    const taskId = await f.add('tasks', {
      title: 'Read',
      project_id: projectId,
    })
    await f.change('tasks', taskId, { status: ProgressStatus.COMPLETED })
    expect(f.sessions()).toHaveLength(1)
    await f.runtime.commands.execute('entityCollection.delete', {
      kind: 'projects',
      action: 'delete',
      id: projectId,
    })
    expect(f.sessions()).toHaveLength(0)
    f.runtime.dispose()
  })
})
