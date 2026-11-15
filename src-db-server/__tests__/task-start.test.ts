import { expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { getDateTimeMillis } from '@c/datetimeUtils'
import { ProgressStatus } from '@c/types/enums'
import { createBackendRuntime } from '@d/bootstrap'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { goals, projects, tasks } from '@d/database/schemas'

const date = '2026-11-02'
const timezone = 'UTC'

async function fixture() {
  const database = new UnHussleDB(':memory:')
  const db = await database.getDb()
  const now = getDateTimeMillis(date, '07:00', timezone)
  const runtime = createBackendRuntime(database, { now: () => now })
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
  const status = {
    task: (id: string) =>
      db.select().from(tasks).where(eq(tasks.id, id)).get()?.status,
    project: (id: string) =>
      db.select().from(projects).where(eq(projects.id, id)).get()?.status,
    goal: (id: string) =>
      db.select().from(goals).where(eq(goals.id, id)).get()?.status,
  }
  return { runtime, add, status }
}

test('starting an occurrence starts its recurring task and its collections', async () => {
  const f = await fixture()
  const goal = await f.add('goals', { title: '12 books' })
  const dune = await f.add('projects', { title: 'Dune', goal_id: goal })
  const read = await f.add('tasks', {
    title: 'Read',
    project_id: dune,
    estimated_minutes: 30,
    tags: [{ title: 'work' }],
    is_recurring: true,
    recurrance_rule: { type: 'daily', data: {} },
  })
  const plan = await f.runtime.commands.execute('scheduler.generate', {
    date,
    timezone,
  })
  const transition = (status: ProgressStatus) =>
    f.runtime.commands.execute('scheduler.occurrence.transition', {
      id: plan.entries[0].id,
      status,
    })

  await transition(ProgressStatus.IN_PROGRESS)
  expect([
    f.status.task(read),
    f.status.project(dune),
    f.status.goal(goal),
  ]).toEqual([
    ProgressStatus.IN_PROGRESS,
    ProgressStatus.IN_PROGRESS,
    ProgressStatus.IN_PROGRESS,
  ])
  // Finishing today's occurrence doesn't finish the habit.
  await transition(ProgressStatus.COMPLETED)
  expect(f.status.task(read)).toBe(ProgressStatus.IN_PROGRESS)
  f.runtime.dispose()
})

test('starting work leaves finished collections finished', async () => {
  const f = await fixture()
  const done = await f.add('projects', {
    title: 'Emma',
    status: ProgressStatus.COMPLETED,
  })
  const task = await f.add('tasks', {
    title: 'Reread a chapter',
    project_id: done,
  })
  await f.runtime.commands.execute('entity.change', {
    kind: 'tasks',
    action: 'update',
    id: task,
    changes: { status: ProgressStatus.IN_PROGRESS },
  })
  expect(f.status.project(done)).toBe(ProgressStatus.COMPLETED)
  f.runtime.dispose()
})
