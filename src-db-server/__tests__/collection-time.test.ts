import { expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { getDateTimeMillis } from '@c/datetimeUtils'
import { ProgressStatus } from '@c/types/enums'
import { createBackendRuntime } from '@d/bootstrap'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { areas, goals, projects } from '@d/database/schemas'

const date = '2026-11-02'
const timezone = 'UTC'

async function fixture() {
  const database = new UnHussleDB(':memory:')
  const db = await database.getDb()
  let now = getDateTimeMillis(date, '07:00', timezone)
  const runtime = createBackendRuntime(database, { now: () => now })
  const add = async (
    kind: 'tasks' | 'projects' | 'goals' | 'areas',
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
    kind: 'tasks' | 'projects',
    id: string,
    changes: Record<string, unknown>,
  ) =>
    runtime.commands.execute(
      kind === 'tasks' ? 'entity.change' : 'entityCollection.change',
      { kind, action: 'update', id, changes },
    )
  const spent = {
    project: (id: string) =>
      db.select().from(projects).where(eq(projects.id, id)).get()
        ?.spent_minutes,
    goal: (id: string) =>
      db.select().from(goals).where(eq(goals.id, id)).get()?.spent_minutes,
    area: (id: string) =>
      db.select().from(areas).where(eq(areas.id, id)).get()?.spent_minutes,
  }
  const work = async (taskId: string, minutes: number) => {
    await change('tasks', taskId, { status: ProgressStatus.IN_PROGRESS })
    now += minutes * 60000
    await change('tasks', taskId, { status: ProgressStatus.PAUSED })
  }
  return { runtime, add, change, spent, work }
}

test('closed time counts once for each collection that holds the task', async () => {
  const f = await fixture()
  const reading = await f.add('areas', { title: 'Reading' })
  const goal = await f.add('goals', { title: '12 books', area_id: reading })
  const dune = await f.add('projects', {
    title: 'Dune',
    goal_id: goal,
    area_id: reading,
  })
  const task = await f.add('tasks', {
    title: 'Chapter 1',
    project_id: dune,
    area_id: reading,
  })
  await f.work(task, 25)
  // The area holds the task three ways but counts it once.
  expect([
    f.spent.project(dune),
    f.spent.goal(goal),
    f.spent.area(reading),
  ]).toEqual([25, 25, 25])
  f.runtime.dispose()
})

test('time stays where it was spent when the task moves on', async () => {
  const f = await fixture()
  const dune = await f.add('projects', { title: 'Dune' })
  const emma = await f.add('projects', { title: 'Emma' })
  const read = await f.add('tasks', { title: 'Read', project_id: dune })
  await f.work(read, 30)
  await f.change('tasks', read, { project_id: emma })
  await f.work(read, 10)
  expect([f.spent.project(dune), f.spent.project(emma)]).toEqual([30, 10])
  f.runtime.dispose()
})

test('completing keeps the live total, and clients cannot set it', async () => {
  const f = await fixture()
  const dune = await f.add('projects', { title: 'Dune' })
  const task = await f.add('tasks', { title: 'Read', project_id: dune })
  await f.work(task, 15)
  await f.change('projects', dune, { spent_minutes: 999 })
  expect(f.spent.project(dune)).toBe(15)
  await f.change('projects', dune, { status: ProgressStatus.COMPLETED })
  expect(f.spent.project(dune)).toBe(15)
  f.runtime.dispose()
})
