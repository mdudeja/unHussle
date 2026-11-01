import { getDateTimeMillis } from '@c/datetimeUtils'
import { describe, expect, test } from 'bun:test'
import { eq, sql } from 'drizzle-orm'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { createBackendRuntime } from '@d/workflows/runtime'
import { nextTask } from '@c/scheduler/engine'
import { defaultSchedulerSettings } from '@c/scheduler/contracts'
import {
  dayPlans,
  taskOccurrences,
  tasks,
  timeEntries,
} from '@d/database/schemas'
import { previewWeek, readDay, readSettings } from '@d/workflows/scheduler'
import { AnchorType, Priority, ProgressStatus } from '@c/types'
import { createTelemetry } from '@c/workflows/telemetry'
import {
  readDayTasks,
  readOccurrences,
  readSchedulerTasks,
} from '@d/database/repositories/scheduler'
import { createSchedulerRoutes } from '@d/routes/scheduler'

const date = '2026-11-02'
const timezone = 'UTC'
async function fixture() {
  const database = new UnHussleDB(':memory:')
  const db = await database.getDb()
  let now = getDateTimeMillis(date, '07:00', timezone)
  const runtime = createBackendRuntime(database, {
    now: () => now,
    telemetry: createTelemetry({ side: 'backend' }),
  })
  const add = async (changes: Record<string, unknown>) => {
    const row = await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes,
    })
    if (!row) throw new Error('Task was not created')
    return row.id
  }
  return {
    database,
    db,
    runtime,
    add,
    now: () => now,
    advance: (minutes: number) => {
      now += minutes * 60000
    },
    generate: () =>
      runtime.commands.execute('scheduler.generate', { date, timezone }),
  }
}

describe('Persistent scheduling commands', () => {
  test('multiple work tags match direct and inherited tags and count each task once', async () => {
    const f = await fixture()
    const app = createSchedulerRoutes(f.database, f.runtime, f.now)
    const response = await app.handle(
      new Request('http://localhost/scheduler/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...defaultSchedulerSettings,
          workTags: [' WORK ', 'client'],
        }),
      }),
    )
    expect(response.status).toBe(200)
    const area = await f.runtime.commands.execute('entityCollection.add', {
      kind: 'areas',
      action: 'create',
      changes: { title: 'Client area', tags: [{ title: 'client' }] },
    })
    if (!area) throw new Error('Area missing')
    const direct = await f.add({ title: 'Direct', tags: [{ title: 'work' }] })
    const inherited = await f.add({ title: 'Inherited', area_id: area.id })
    const both = await f.add({
      title: 'Both',
      area_id: area.id,
      tags: [{ title: 'work' }, { title: 'client' }],
    })
    const personal = await f.add({
      title: 'Personal',
      tags: [{ title: 'private' }],
    })
    const snapshot = readSchedulerTasks(f.db, readSettings(f.db))
    expect(
      snapshot
        .filter((task) => task.isWork)
        .map((task) => task.id)
        .sort(),
    ).toEqual([direct, inherited, both].sort())
    expect(snapshot.find((task) => task.id === personal)?.isWork).toBe(false)
    expect((await f.generate()).workPlanned).toBe(90)
    f.runtime.dispose()
  })
  test('an empty work-tag selection classifies no tasks as work', async () => {
    const f = await fixture()
    await f.add({ title: 'Tagged', tags: [{ title: 'work' }] })
    await f.runtime.commands.execute('scheduler.settings.change', {
      settings: { ...defaultSchedulerSettings, workTags: [] },
    })
    expect(readSchedulerTasks(f.db, readSettings(f.db))[0].isWork).toBe(false)
    f.runtime.dispose()
  })
  test('blank work-tag names and the old HTTP shape are rejected', async () => {
    const f = await fixture()
    await expect(
      f.runtime.commands.execute('scheduler.settings.change', {
        settings: { ...defaultSchedulerSettings, workTags: [' '] },
      }),
    ).rejects.toThrow('tag names')
    const app = createSchedulerRoutes(f.database, f.runtime, f.now)
    const legacy = { ...defaultSchedulerSettings, workTag: 'work' }
    Reflect.deleteProperty(legacy, 'workTags')
    const response = await app.handle(
      new Request('http://localhost/scheduler/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(legacy),
      }),
    )
    expect(response.status).toBe(400)
    f.runtime.dispose()
  })
  test('an active occurrence stays in focus across midnight without completing the new day’s occurrence', async () => {
    const f = await fixture()
    const id = await f.add({
      title: 'Late recurring task',
      estimated_minutes: 180,
      tags: [{ title: 'work' }],
      is_recurring: true,
      recurrance_rule: { type: 'daily', data: {} },
    })
    const original = await f.generate()
    f.advance(16 * 60)
    await f.runtime.commands.execute('occurrence.transition', {
      id: original.entries[0].id,
      status: ProgressStatus.IN_PROGRESS,
    })
    f.advance(2 * 60)
    await f.runtime.commands.execute('scheduler.generate', {
      date: '2026-11-03',
      timezone,
    })
    let current = readDay(f.db, '2026-11-03', timezone, f.now())
    expect(nextTask(current, f.now()).item?.id).toBe(original.entries[0].id)
    expect(current.workUsed).toBe(60)
    await f.runtime.commands.execute('occurrence.transition', {
      id: original.entries[0].id,
      status: ProgressStatus.COMPLETED,
    })
    current = readDay(f.db, '2026-11-03', timezone, f.now())
    expect(
      current.entries.find((i) => i.id === original.entries[0].id)?.status,
    ).toBe('completed')
    expect(
      current.entries.find((i) => i.id === `${id}:2026-11-03:0`)?.status,
    ).toBe('planned')
    expect(
      f.db.select().from(tasks).where(eq(tasks.id, id)).get()?.spent_minutes,
    ).toBe(120)
    f.runtime.dispose()
  })
  test('backend intervals own cumulative time and repeated pauses do not double count', async () => {
    const f = await fixture()
    const id = await f.add({ title: 'Tracked' })
    const change = (status: ProgressStatus, spent_minutes?: number) =>
      f.runtime.commands.execute('entity.change', {
        kind: 'tasks',
        action: 'update',
        id,
        changes: {
          status,
          ...(spent_minutes === undefined ? {} : { spent_minutes }),
        },
      })
    await change(ProgressStatus.IN_PROGRESS)
    f.advance(5)
    await change(ProgressStatus.PAUSED)
    await change(ProgressStatus.PAUSED, 999)
    expect(
      f.db.select().from(tasks).where(eq(tasks.id, id)).get()?.spent_minutes,
    ).toBe(5)
    await change(ProgressStatus.IN_PROGRESS)
    f.advance(5)
    await change(ProgressStatus.COMPLETED, 999)
    expect(
      f.db.select().from(tasks).where(eq(tasks.id, id)).get()?.spent_minutes,
    ).toBe(10)
    expect(f.db.select().from(timeEntries).all()).toHaveLength(2)
    f.runtime.dispose()
  })
  test('unfinished one-offs carry to a new day once, while saved future choices stay reserved', async () => {
    const f = await fixture()
    const id = await f.add({ title: 'Unfinished' })
    await f.generate()
    const reserved = await f.runtime.commands.execute('scheduler.generate', {
      date: '2026-11-03',
      timezone,
    })
    expect(reserved.entries.some((i) => i.id === id)).toBe(false)
    f.advance(24 * 60)
    const carried = await f.runtime.commands.execute('scheduler.replan', {
      date: '2026-11-03',
      timezone,
    })
    expect(carried.entries.some((i) => i.id === id)).toBe(true)
    expect(
      readDay(f.db, date, timezone, f.now()).entries.find((i) => i.id === id)
        ?.status,
    ).toBe('migrated')
    f.runtime.dispose()
  })
  test('saving a future tentative day preserves its preview allocation', async () => {
    const f = await fixture()
    await f.runtime.commands.execute('scheduler.settings.change', {
      settings: { ...defaultSchedulerSettings, sleep: '07:30', overrides: {} },
    })
    await f.add({
      title: 'First',
      estimated_minutes: 30,
      priority: Priority.HIGH,
    })
    await f.add({
      title: 'Second',
      estimated_minutes: 30,
      priority: Priority.LOW,
    })
    const preview = previewWeek(f.db, date, timezone, f.now())
    const saved = await f.runtime.commands.execute('scheduler.generate', {
      date: '2026-11-03',
      timezone,
    })
    expect(saved.entries.map((i) => i.id)).toEqual(
      preview[1].entries.map((i) => i.id),
    )
    f.runtime.dispose()
  })
  test('HTTP endpoints validate inputs, preserve operation ids, and reject stale edits', async () => {
    const f = await fixture()
    const id = await f.add({ title: 'HTTP task' })
    const app = createSchedulerRoutes(f.database, f.runtime, f.now)
    const events: string[] = []
    f.runtime.events.on('scheduler.changed', (_name, event) => {
      events.push(event.operationId)
    })
    const send = (path: string, body: unknown) =>
      app.handle(
        new Request(`http://localhost/scheduler/${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-operation-id': 'scheduler-http',
          },
          body: JSON.stringify(body),
        }),
      )
    expect(
      (
        await app.handle(
          new Request(`http://localhost/scheduler/week/${date}?timezone=UTC`),
        )
      ).status,
    ).toBe(200)
    expect(f.db.select().from(dayPlans).all()).toHaveLength(0)
    const response = await send('generate', { date, timezone })
    expect(response.status).toBe(200)
    const saved = (await response.json()) as { revision: number }
    expect(events).toEqual(['scheduler-http'])
    const replanned = await send('replan', {
      date,
      timezone,
      revision: saved.revision,
      cue: 'fresh',
    })
    if (!replanned.ok) throw new Error(await replanned.text())
    const nextRevision = ((await replanned.json()) as { revision: number })
      .revision
    const adjusted = await send('adjust', {
      date,
      timezone,
      revision: nextRevision,
      itemId: id,
      action: 'pin',
    })
    if (!adjusted.ok) throw new Error(await adjusted.text())
    expect(adjusted.status).toBe(200)
    expect(
      (
        await send('adjust', {
          date,
          timezone,
          revision: saved.revision,
          itemId: id,
          action: 'pin',
        })
      ).status,
    ).toBe(409)
    expect(
      (await send('generate', { date: 'not-a-date', timezone })).status,
    ).toBe(400)
    expect(
      (await send('generate', { date, timezone: 'invalid/timezone' })).status,
    ).toBe(400)
    f.runtime.dispose()
  })
  test('generation is idempotent and reads do not write plans or occurrences', async () => {
    const f = await fixture()
    await f.add({
      title: 'Recurring',
      is_recurring: true,
      recurrance_rule: { type: 'daily', data: {} },
    })
    previewWeek(f.db, date, timezone, f.now())
    readDay(f.db, date, timezone, f.now())
    expect(f.db.select().from(dayPlans).all()).toHaveLength(0)
    expect(f.db.select().from(taskOccurrences).all()).toHaveLength(0)
    const first = await f.generate()
    const second = await f.generate()
    expect(first.revision).toBe(second.revision)
    expect(f.db.select().from(taskOccurrences).all()).toHaveLength(1)
    f.runtime.dispose()
  })
  test('stable stack survives priority edits and replanning preserves pins', async () => {
    const f = await fixture()
    const a = await f.add({ title: 'A', priority: Priority.HIGH })
    const b = await f.add({ title: 'B', priority: Priority.LOW })
    const first = await f.generate()
    const pinned = await f.runtime.commands.execute('scheduler.adjust', {
      date,
      timezone,
      revision: first.revision,
      itemId: a,
      action: 'pin',
    })
    await f.runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id: b,
      changes: { priority: Priority.HIGH, due_date: f.now() },
    })
    const stable = readDay(f.db, date, timezone, f.now())
    expect(stable.entries.map((i) => i.id)).toEqual([a, b])
    expect(stable.stale).toBe(true)
    // Review is flagged, but the saved order didn't change underneath the client.
    expect(stable.revision).toBe(pinned.revision)
    const replanned = await f.runtime.commands.execute('scheduler.replan', {
      date,
      timezone,
      revision: stable.revision,
    })
    expect(replanned.entries[0].id).toBe(a)
    expect(replanned.entries[0].pinned).toBe(true)
    f.runtime.dispose()
  })
  test('concurrent edits reject stale revisions without publishing completion', async () => {
    const f = await fixture()
    const id = await f.add({ title: 'A' })
    const first = await f.generate()
    await f.runtime.commands.execute('scheduler.adjust', {
      date,
      timezone,
      revision: first.revision,
      itemId: id,
      action: 'pin',
    })
    let events = 0
    f.runtime.events.on('scheduler.changed', () => {
      events++
    })
    await expect(
      f.runtime.commands.execute('scheduler.adjust', {
        date,
        timezone,
        revision: first.revision,
        itemId: id,
        action: 'pin',
      }),
    ).rejects.toThrow('Refresh')
    expect(events).toBe(0)
    expect(readDay(f.db, date, timezone, f.now()).entries[0].pinned).toBe(true)
    f.runtime.dispose()
  })
  test('deferral survives replanning and becomes eligible on its selected date', async () => {
    const f = await fixture()
    const id = await f.add({ title: 'Later' })
    const first = await f.generate()
    const adjusted = await f.runtime.commands.execute('scheduler.adjust', {
      date,
      timezone,
      revision: first.revision,
      itemId: id,
      action: 'defer',
      until: '2026-11-04',
    })
    expect(adjusted.entries).toHaveLength(0)
    expect(
      (await f.runtime.commands.execute('scheduler.replan', { date, timezone }))
        .entries,
    ).toHaveLength(0)
    const week = previewWeek(f.db, date, timezone, f.now())
    expect(week[1].entries.some((i) => i.id === id)).toBe(false)
    expect(week[2].entries.some((i) => i.id === id)).toBe(true)
    f.runtime.dispose()
  })
  test('week previews allocate one-offs once, with independent daily occurrences', async () => {
    const f = await fixture()
    await f.runtime.commands.execute('scheduler.settings.change', {
      settings: { ...defaultSchedulerSettings, sleep: '08:00', overrides: {} },
    })
    for (let i = 0; i < 6; i++)
      await f.add({ title: `Task ${i}`, estimated_minutes: 30 })
    await f.add({
      title: 'Daily',
      estimated_minutes: 5,
      is_recurring: true,
      recurrance_rule: { type: 'daily', data: {} },
    })
    const week = previewWeek(f.db, date, timezone, f.now())
    const ids = week.flatMap((p) =>
      p.entries.filter((i) => !i.occurrenceId).map((i) => i.id),
    )
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toHaveLength(6)
    expect(week.every((p) => p.entries.some((i) => i.occurrenceId))).toBe(true)
    expect(f.db.select().from(dayPlans).all()).toHaveLength(0)
    f.runtime.dispose()
  })
  test('recurring slots complete independently, expire without backlog, and leave the template active', async () => {
    const f = await fixture()
    const id = await f.add({
      title: 'Teeth',
      estimated_minutes: 3,
      is_recurring: true,
      recurrance_rule: {
        type: 'daily',
        data: {
          slots: [
            { from: 420, to: 480 },
            { from: 1200, to: 1260 },
          ],
        },
      },
    })
    const first = await f.generate()
    await f.runtime.commands.execute('occurrence.transition', {
      id: first.entries[0].id,
      status: ProgressStatus.COMPLETED,
    })
    expect(
      f.db.select().from(tasks).where(eq(tasks.id, id)).get()?.status,
    ).toBe(ProgressStatus.PLANNED)
    expect(
      nextTask(readDay(f.db, date, timezone, f.now()), f.now()).item,
    ).toBeNull()
    f.advance(24 * 60)
    const tomorrow = await f.runtime.commands.execute('scheduler.generate', {
      date: '2026-11-03',
      timezone,
    })
    expect(tomorrow.entries).toHaveLength(2)
    expect(
      f.db
        .select()
        .from(taskOccurrences)
        .where(eq(taskOccurrences.id, first.entries[1].id))
        .get()?.status,
    ).toBe('missed')
    f.runtime.dispose()
  })
  test('work tags inherit from collection ancestry and active time crosses midnight correctly', async () => {
    const f = await fixture()
    const area = await f.runtime.commands.execute('entityCollection.add', {
      kind: 'areas',
      action: 'create',
      changes: { title: 'Work', tags: [{ title: 'work' }] },
    })
    if (!area) throw new Error('Area missing')
    const goal = await f.runtime.commands.execute('entityCollection.add', {
      kind: 'goals',
      action: 'create',
      changes: { title: 'Goal', area_id: area.id },
    })
    if (!goal) throw new Error('Goal missing')
    const project = await f.runtime.commands.execute('entityCollection.add', {
      kind: 'projects',
      action: 'create',
      changes: { title: 'Project', goal_id: goal.id },
    })
    if (!project) throw new Error('Project missing')
    const id = await f.add({ title: 'Work task', project_id: project.id })
    expect(readSchedulerTasks(f.db, readSettings(f.db))[0].isWork).toBe(true)
    f.db
      .insert(timeEntries)
      .values({
        task_id: id,
        start_time: getDateTimeMillis('2026-11-01', '23:30', timezone),
        end_time: getDateTimeMillis(date, '00:30', timezone),
      })
      .run()
    expect((await f.generate()).workUsed).toBe(30)
    await f.runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id,
      changes: { status: ProgressStatus.IN_PROGRESS },
    })
    f.advance(10)
    expect(readDay(f.db, date, timezone, f.now()).workUsed).toBe(40)
    await f.runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id,
      changes: { status: ProgressStatus.PAUSED, spent_minutes: 10 },
    })
    expect(readDay(f.db, date, timezone, f.now()).workUsed).toBe(40)
    expect(
      f.db
        .select()
        .from(timeEntries)
        .all()
        .every((e) => e.end_time !== null),
    ).toBe(true)
    f.runtime.dispose()
  })
  test('invalid anchor changes roll back and newly added appointments appear in a saved day', async () => {
    const f = await fixture()
    const id = await f.add({ title: 'A' })
    await f.generate()
    await expect(
      f.runtime.commands.execute('entity.change', {
        kind: 'tasks',
        action: 'update',
        id,
        changes: { anchor_id: id, anchor_type: AnchorType.after },
      }),
    ).rejects.toThrow('cycles')
    expect(
      f.db.select().from(tasks).where(eq(tasks.id, id)).get()?.anchor_id,
    ).toBeNull()
    const meeting = await f.add({
      title: 'Meeting',
      scheduled_start: f.now(),
      scheduled_end: f.now() + 60000,
    })
    expect(
      nextTask(readDay(f.db, date, timezone, f.now()), f.now()).item?.id,
    ).toBe(meeting)
    await f.runtime.commands.execute('entity.delete', {
      kind: 'tasks',
      action: 'delete',
      id: meeting,
    })
    expect(
      nextTask(readDay(f.db, date, timezone, f.now()), f.now()).item?.id,
    ).toBe(id)
    f.runtime.dispose()
  })
  test('impossible manual anchor moves roll back the plan', async () => {
    const f = await fixture()
    const a = await f.add({ title: 'A' })
    const b = await f.add({
      title: 'B',
      anchor_id: a,
      anchor_type: AnchorType.after,
    })
    const first = await f.generate()
    await expect(
      f.runtime.commands.execute('scheduler.adjust', {
        date,
        timezone,
        revision: first.revision,
        itemId: b,
        action: 'move',
        position: 0,
      }),
    ).rejects.toThrow('anchor constraint')
    expect(
      readDay(f.db, date, timezone, f.now()).entries.map((i) => i.id),
    ).toEqual([a, b])
    f.runtime.dispose()
  })
})

describe('Scheduler repository boundaries', () => {
  test('task edits leave unrelated saved history untouched', async () => {
    const f = await fixture()
    const id = await f.add({ title: 'History' })
    const plan = await f.generate()
    await f.runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id,
      changes: { status: ProgressStatus.COMPLETED },
    })
    const history = f.db
      .select()
      .from(dayPlans)
      .where(eq(dayPlans.id, `${timezone}:${date}`))
      .get()!
    await f.add({ title: 'Unrelated' })
    const after = f.db
      .select()
      .from(dayPlans)
      .where(eq(dayPlans.id, history.id))
      .get()!
    expect(after.revision).toBe(history.revision)
    expect(readDay(f.db, date, timezone, f.now()).stale).toBe(true)
    expect(plan.entries[0].taskId).toBe(id)
    f.runtime.dispose()
  })

  test('completed occurrence history survives task deletion with nullable live references', async () => {
    const f = await fixture()
    const id = await f.add({
      title: 'Recurring',
      is_recurring: true,
      recurrance_rule: { type: 'daily', data: {} },
    })
    const plan = await f.generate()
    await f.runtime.commands.execute('occurrence.transition', {
      id: plan.entries[0].id,
      status: ProgressStatus.COMPLETED,
    })
    const related = f.db.query.tasks
      .findFirst({
        where: eq(tasks.id, id),
        with: {
          occurrences: true,
          scheduleItems: { with: { plan: true, occurrence: true } },
        },
      })
      .sync()!
    expect(related.occurrences).toHaveLength(1)
    expect(related.scheduleItems[0].occurrence?.sourceTaskId).toBe(id)
    expect(related.scheduleItems[0].plan.date).toBe(date)
    await f.runtime.commands.execute('entity.delete', {
      kind: 'tasks',
      action: 'delete',
      id,
    })
    const occurrence = f.db.query.taskOccurrences
      .findFirst({
        where: eq(taskOccurrences.id, plan.entries[0].id),
        with: { task: true, entries: true },
      })
      .sync()!
    expect(occurrence.taskId).toBeNull()
    expect(occurrence.task).toBeNull()
    expect(occurrence.sourceTaskId).toBe(id)
    expect(occurrence.entries).toHaveLength(1)
    expect(readDay(f.db, date, timezone, f.now()).entries[0].status).toBe(
      'completed',
    )
    expect(f.db.all(sql`pragma foreign_key_check`)).toEqual([])
    f.runtime.dispose()
  })

  test('historical tasks and occurrences stay out of day inputs and work totals retain fractional minutes', async () => {
    const f = await fixture()
    const id = await f.add({ title: 'Current', tags: [{ title: 'work' }] })
    const now = f.now()
    f.db.transaction((tx) => {
      for (let i = 0; i < 1000; i++) {
        tx.insert(tasks)
          .values({
            id: `history-${i}`,
            title: 'Old completed task',
            status: ProgressStatus.COMPLETED,
          })
          .run()
        tx.insert(taskOccurrences)
          .values({
            id: `old-${i}`,
            sourceTaskId: `history-${i}`,
            taskId: `history-${i}`,
            date: '2020-01-01',
            slot: 0,
            status: 'completed',
          })
          .run()
        tx.insert(timeEntries)
          .values({
            id: `old-entry-${i}`,
            task_id: id,
            start_time: now - 10 * 86400000,
            end_time: now - 9 * 86400000,
          })
          .run()
      }
    })
    f.db
      .insert(timeEntries)
      .values({
        id: 'fractional',
        task_id: id,
        start_time: now - 90000,
        end_time: now,
      })
      .run()
    const snapshot = readSchedulerTasks(f.db, readSettings(f.db))
    expect(snapshot.map((task) => task.id)).toEqual([id])
    expect(readDay(f.db, date, timezone, now).workUsed).toBe(1.5)
    expect(readOccurrences(f.db, date, date)).toEqual([])
    const plan = f.db.all<{ detail: string }>(
      sql`explain query plan select * from task_occurrences where date = ${date} and status = 'planned'`,
    )
    expect(
      plan.some((row) =>
        /occurrence_(date_status|status_date)_idx/.test(row.detail),
      ),
    ).toBe(true)
    const members = f.db.all<{ detail: string }>(
      sql`explain query plan select * from plan_items where source_task_id = ${id} and status = 'planned'`,
    )
    expect(
      members.some((row) =>
        row.detail.includes('plan_items_source_status_idx'),
      ),
    ).toBe(true)
    f.runtime.dispose()
  })
})

test('saved-day hydration stays scoped while SQL counts a growing pending backlog', async () => {
  const f = await fixture()
  const id = await f.add({ title: 'Saved task' })
  const saved = await f.generate()
  f.db.transaction((tx) => {
    for (let i = 0; i < 1000; i++)
      tx.insert(tasks)
        .values({ id: `pending-${i}`, title: 'Backlog' })
        .run()
    tx.insert(tasks)
      .values({
        id: 'other-weekday',
        title: 'Tomorrow only',
        is_recurring: true,
        recurrance_rule: { type: 'weekly', data: { weekDays: [2] } },
      })
      .run()
    tx.insert(tasks)
      .values({
        id: 'two-slots',
        title: 'Twice',
        is_recurring: true,
        recurrance_rule: {
          type: 'daily',
          data: {
            slots: [
              { from: 0, to: 720 },
              { from: 720, to: 1440 },
            ],
          },
        },
      })
      .run()
    tx.insert(taskOccurrences)
      .values({
        id: `two-slots:${date}:0`,
        sourceTaskId: 'two-slots',
        taskId: 'two-slots',
        date,
        slot: 0,
        status: 'completed',
      })
      .run()
  })
  expect(
    readDayTasks(
      f.db,
      readSettings(f.db),
      date,
      timezone,
      [id],
      false,
    ).candidates.map((task) => task.id),
  ).toEqual([id])
  const read = readDay(f.db, date, timezone, f.now())
  expect(read.entries.map((item) => item.id)).toEqual(
    saved.entries.map((item) => item.id),
  )
  expect(read.backlogCount).toBe(1001)
  f.runtime.dispose()
})

describe('Scheduler candidate preparation', () => {
  test('future anchors remain references and cannot enter the current stack', async () => {
    const f = await fixture()
    const anchor = await f.add({
      title: 'Tomorrow',
      scheduled_start: getDateTimeMillis('2026-11-03', '09:00', timezone),
    })
    const dependent = await f.add({
      title: 'After tomorrow',
      anchor_id: anchor,
      anchor_type: AnchorType.after,
    })
    const input = readDayTasks(f.db, readSettings(f.db), date, timezone)
    expect(input.candidates.map((task) => task.id)).toEqual([dependent])
    expect(input.references.map((task) => task.id)).toEqual([anchor])
    const plan = await f.generate()
    expect(plan.entries).toEqual([])
    expect(plan.conflicts.some((message) => message.includes('anchor'))).toBe(
      true,
    )
    f.runtime.dispose()
  })

  test('calendar selectors and recurring start dates are resolved by the repository', async () => {
    const f = await fixture()
    const leap = await f.add({
      title: 'Leap day',
      is_recurring: true,
      recurrance_rule: {
        type: 'yearly',
        data: { months: [2], monthDays: [29], weekDays: [] },
      },
    })
    const weekly = await f.add({
      title: 'Mondays',
      is_recurring: true,
      recurrance_rule: { type: 'weekly', data: { weekDays: [1] } },
    })
    const zoned = await f.add({
      title: 'Starts late Sunday locally',
      is_recurring: true,
      scheduled_start: getDateTimeMillis(date, '00:30', 'UTC'),
      recurrance_rule: { type: 'daily', data: {} },
    })
    const candidates = (day: string, zone = timezone) =>
      readDayTasks(f.db, readSettings(f.db), day, zone).candidates.map(
        (task) => task.id,
      )
    expect(candidates('2028-02-29')).toContain(leap)
    expect(candidates('2027-03-01')).not.toContain(leap)
    expect(candidates(date)).toContain(weekly)
    expect(candidates('2026-11-03')).not.toContain(weekly)
    expect(candidates('2026-11-01', 'America/Los_Angeles')).toContain(zoned)
    expect(candidates('2026-11-01', 'UTC')).not.toContain(zoned)
    f.runtime.dispose()
  })

  test('an active weekly occurrence continues on a day when its template is ineligible', async () => {
    const f = await fixture()
    await f.add({
      title: 'Monday recurring task',
      is_recurring: true,
      recurrance_rule: { type: 'weekly', data: { weekDays: [1] } },
    })
    const original = await f.generate()
    await f.runtime.commands.execute('occurrence.transition', {
      id: original.entries[0].id,
      status: ProgressStatus.IN_PROGRESS,
    })
    f.advance(24 * 60)
    const ordinary = await f.add({ title: 'Tuesday task' })
    const following = await f.runtime.commands.execute('scheduler.generate', {
      date: '2026-11-03',
      timezone,
    })
    expect(following.entries.map((item) => item.id).sort()).toEqual(
      [original.entries[0].id, ordinary].sort(),
    )
    expect(nextTask(following, f.now()).item?.id).toBe(original.entries[0].id)
    f.runtime.dispose()
  })

  test('multi-task anchor cycles are rejected and rolled back at the write boundary', async () => {
    const f = await fixture()
    const a = await f.add({ title: 'A' })
    const b = await f.add({
      title: 'B',
      anchor_id: a,
      anchor_type: AnchorType.after,
    })
    await expect(
      f.runtime.commands.execute('entity.change', {
        kind: 'tasks',
        action: 'update',
        id: a,
        changes: { anchor_id: b, anchor_type: AnchorType.after },
      }),
    ).rejects.toThrow('cycles')
    expect(
      f.db.select().from(tasks).where(eq(tasks.id, a)).get()?.anchor_id,
    ).toBeNull()
    f.runtime.dispose()
  })
})

describe('Scheduler maintenance actions', () => {
  test('rule reasons survive saving and reading a plan', async () => {
    const f = await fixture()
    await f.add({ title: 'Due', due_date: f.now() })
    const saved = await f.generate()
    expect(saved.entries[0].reason).toBe('Due today')
    expect(readDay(f.db, date, timezone, f.now()).entries[0].reason).toBe(
      'Due today',
    )
    f.runtime.dispose()
  })

  test('only schedule-relevant changes mark saved plans for review', async () => {
    const f = await fixture()
    const id = await f.add({ title: 'A' })
    await f.generate()
    const stale = () => readDay(f.db, date, timezone, f.now()).stale
    const reset = () => f.db.update(dayPlans).set({ stale: false }).run()
    await f.runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id,
      changes: { title: 'Renamed' },
    })
    expect(stale()).toBe(false)
    await f.runtime.commands.execute('entitySupporter.add', {
      kind: 'urls',
      action: 'create',
      changes: { url: 'https://example.com' },
    })
    expect(stale()).toBe(false)
    await f.runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id,
      changes: { priority: Priority.HIGH },
    })
    expect(stale()).toBe(true)
    reset()
    await f.runtime.commands.execute('scheduler.settings.change', {
      settings: { ...defaultSchedulerSettings, workMinutes: 60 },
    })
    expect(stale()).toBe(true)
    f.runtime.dispose()
  })

  test('an invalid task write rolls back its tracking interval too', async () => {
    const f = await fixture()
    await expect(
      f.add({
        title: 'Broken',
        status: ProgressStatus.IN_PROGRESS,
        scheduled_start: f.now(),
        scheduled_end: f.now() - 60000,
      }),
    ).rejects.toThrow('Scheduled end')
    expect(f.db.select().from(tasks).all()).toHaveLength(0)
    expect(f.db.select().from(timeEntries).all()).toHaveLength(0)
    const id = await f.add({
      title: 'Started',
      status: ProgressStatus.IN_PROGRESS,
    })
    const started = f.db.select().from(tasks).where(eq(tasks.id, id)).get()
    expect(started?.started_at).toBe(f.now())
    expect(f.db.select().from(timeEntries).all()).toHaveLength(1)
    f.runtime.dispose()
  })

  test('removing a slot cancels its untouched occurrence in saved plans', async () => {
    const f = await fixture()
    const slots = [
      { from: 420, to: 480 },
      { from: 1200, to: 1260 },
    ]
    const id = await f.add({
      title: 'Twice',
      is_recurring: true,
      recurrance_rule: { type: 'daily', data: { slots } },
    })
    const saved = await f.generate()
    expect(saved.entries).toHaveLength(2)
    await f.runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id,
      changes: {
        recurrance_rule: { type: 'daily', data: { slots: slots.slice(0, 1) } },
      },
    })
    const after = readDay(f.db, date, timezone, f.now())
    expect(
      after.entries.find((entry) => entry.id === `${id}:${date}:1`)?.status,
    ).toBe('cancelled')
    expect(after.revision).toBeGreaterThan(saved.revision)
    expect(
      f.db
        .select()
        .from(taskOccurrences)
        .where(eq(taskOccurrences.id, `${id}:${date}:1`))
        .get(),
    ).toBeUndefined()
    f.runtime.dispose()
  })
})

describe('Day modes', () => {
  const mode = (
    f: Awaited<ReturnType<typeof fixture>>,
    change: 'startBreak' | 'endBreak' | 'startWrap',
    reason?: 'manual' | 'lastTask' | 'windDown',
  ) =>
    f.runtime.commands.execute('scheduler.mode.change', {
      date,
      timezone,
      change,
      ...(reason ? { reason } : {}),
    })

  test('a break pauses running work, plans an easy return and ends without re-planning', async () => {
    const f = await fixture()
    const long = await f.add({ title: 'Long', estimated_minutes: 60 })
    const quick = await f.add({ title: 'Quick', is_quick: true })
    await f.generate()
    await f.runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id: long,
      changes: { status: ProgressStatus.IN_PROGRESS },
    })
    f.advance(20)
    const onBreak = await mode(f, 'startBreak')
    expect(onBreak.breakStartedAt).toBe(f.now())
    const paused = f.db.select().from(tasks).where(eq(tasks.id, long)).get()
    expect(paused?.status).toBe(ProgressStatus.PAUSED)
    expect(paused?.spent_minutes).toBe(20)
    expect(
      f.db
        .select()
        .from(timeEntries)
        .all()
        .every((e) => e.end_time !== null),
    ).toBe(true)
    expect(nextTask(onBreak, f.now()).item?.taskId).toBe(quick)

    // Starting a break twice changes nothing.
    expect((await mode(f, 'startBreak')).revision).toBe(onBreak.revision)

    f.advance(15)
    const back = await mode(f, 'endBreak')
    expect(back.breakStartedAt).toBeNull()
    expect(back.entries.map((e) => e.id)).toEqual(
      onBreak.entries.map((e) => e.id),
    )
    expect(readDay(f.db, date, timezone, f.now()).breakStartedAt).toBeNull()
    f.runtime.dispose()
  })

  test('wrapping up keeps only chores until the user pulls more', async () => {
    const f = await fixture()
    await f.add({ title: 'Report' })
    const dishes = await f.add({ title: 'Dishes', is_chore: true })
    await f.generate()

    const wrapped = await mode(f, 'startWrap')
    expect(wrapped.wrapReason).toBe('manual')
    expect(wrapped.entries.map((e) => e.taskId)).toEqual([dishes])

    // Rescheduling while wrapping up stays chores-only.
    const rescheduled = await f.runtime.commands.execute('scheduler.replan', {
      date,
      timezone,
    })
    expect(rescheduled.entries.map((e) => e.taskId)).toEqual([dishes])

    const more = await f.runtime.commands.execute('scheduler.replan', {
      date,
      timezone,
      cue: 'more',
    })
    expect(more.wrapReason).toBeNull()
    expect(more.autoWrap).toBe(false)
    expect(more.entries).toHaveLength(2)

    // After pulling more, automatic wrap-up is ignored; a manual one still works.
    expect((await mode(f, 'startWrap', 'windDown')).wrapReason).toBeNull()
    expect((await mode(f, 'startWrap')).wrapReason).toBe('manual')
    f.runtime.dispose()
  })

  test('automatic wrap-up never interrupts a break', async () => {
    const f = await fixture()
    await f.add({ title: 'Report' })
    await f.generate()
    await mode(f, 'startBreak')
    const result = await mode(f, 'startWrap', 'lastTask')
    expect(result.wrapReason).toBeNull()
    expect(result.breakStartedAt).not.toBeNull()
    f.runtime.dispose()
  })

  test('settings saved before wrapMinutes existed read with its default', async () => {
    const f = await fixture()
    const legacy: Record<string, unknown> = { ...defaultSchedulerSettings }
    delete legacy.wrapMinutes
    f.db.run(
      sql`INSERT INTO scheduler_settings (id, settings) VALUES ('default', ${JSON.stringify(legacy)})`,
    )
    expect(readSettings(f.db).wrapMinutes).toBe(30)
    f.runtime.dispose()
  })
})

describe('Work carried across days', () => {
  test('a task paused yesterday is resumed ahead of older untouched work', async () => {
    const f = await fixture()
    await f.runtime.commands.execute('scheduler.settings.change', {
      settings: { ...defaultSchedulerSettings, sleep: '08:00', overrides: {} },
    })
    await f.add({ title: 'Older A', estimated_minutes: 30 })
    await f.add({ title: 'Older B', estimated_minutes: 30 })
    const started = await f.add({ title: 'Started', estimated_minutes: 60 })
    await f.generate()
    for (const status of [ProgressStatus.IN_PROGRESS, ProgressStatus.PAUSED]) {
      await f.runtime.commands.execute('entity.change', {
        kind: 'tasks',
        action: 'update',
        id: started,
        changes: { status },
      })
      f.advance(30)
    }
    f.advance(23 * 60)
    const tomorrow = await f.runtime.commands.execute('scheduler.generate', {
      date: '2026-11-03',
      timezone,
    })
    expect(tomorrow.entries[0].taskId).toBe(started)
    expect(tomorrow.entries[0].minutes).toBe(30)
    f.runtime.dispose()
  })

  test('tracking.stop closes a running interval at the time the user gives', async () => {
    const f = await fixture()
    const id = await f.add({ title: 'Essay' })
    await f.runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id,
      changes: { status: ProgressStatus.IN_PROGRESS },
    })
    const started = f.now()
    f.advance(24 * 60)
    const stop = (at: number) =>
      f.runtime.commands.execute('tracking.stop', {
        taskId: id,
        occurrenceId: null,
        at,
      })
    await expect(stop(started - 1)).rejects.toThrow('between')
    await expect(stop(f.now() + 1)).rejects.toThrow('between')
    const entry = await stop(started + 90 * 60000)
    expect(entry.end_time).toBe(started + 90 * 60000)
    const task = f.db.select().from(tasks).where(eq(tasks.id, id)).get()
    expect(task?.status).toBe(ProgressStatus.PAUSED)
    expect(task?.spent_minutes).toBe(90)
    await expect(stop(f.now())).rejects.toThrow('no longer running')
    f.runtime.dispose()
  })
})
