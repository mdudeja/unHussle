import { describe, expect, test } from 'bun:test'
import { eq, isNull } from 'drizzle-orm'
import { UnHussleDB } from '@d/database/UnHussleDB'
import { createBackendRuntime } from '@d/workflows/runtime'
import {
  tasks,
  timeEntries,
  taskOccurrences,
  planItems,
  tags,
} from '@d/database/schemas'
import { ProgressStatus } from '@c/types/enums'
import { getDateTimeMillis } from '@c/datetimeUtils'
import type { EntryRecord, MutationEvent } from '@c/workflows/contracts'

async function fixture() {
  const database = new UnHussleDB(':memory:')
  const db = await database.getDb()
  let now = getDateTimeMillis('2026-11-02', '09:00', 'UTC')
  const runtime = createBackendRuntime(database, { now: () => now })
  const add = async (title: string, changes: Record<string, unknown> = {}) =>
    (await runtime.commands.execute('entity.add', {
      kind: 'tasks',
      action: 'create',
      changes: { title, estimated_minutes: 15, ...changes },
    })) as EntryRecord
  const transition = (
    id: string,
    status: ProgressStatus,
    changes: Record<string, unknown> = {},
  ) =>
    runtime.commands.execute('entity.change', {
      kind: 'tasks',
      action: 'update',
      id,
      changes: { ...changes, status },
    })
  return {
    db,
    runtime,
    add,
    transition,
    now: () => now,
    advance: (minutes: number) => {
      now += minutes * 60_000
    },
  }
}

describe('Backend domain boundaries', () => {
  test('direct commands validate task status without relying on HTTP schemas', async () => {
    const f = await fixture()
    try {
      const task = await f.add('Running', {
        status: ProgressStatus.IN_PROGRESS,
      })
      for (const status of [null, 'not_a_status']) {
        await expect(
          f.runtime.commands.execute('entity.change', {
            kind: 'tasks',
            action: 'update',
            id: task.id,
            changes: { status },
          }),
        ).rejects.toThrow('Invalid task status')
      }
      expect(
        f.db.select().from(tasks).where(eq(tasks.id, task.id)).get()?.status,
      ).toBe(ProgressStatus.IN_PROGRESS)
      expect(
        f.db
          .select()
          .from(timeEntries)
          .where(isNull(timeEntries.end_time))
          .all(),
      ).toHaveLength(1)
    } finally {
      f.runtime.dispose()
    }
  })
  test('row templates are not public commands and the wrong family cannot bypass task integrity', async () => {
    const f = await fixture()
    try {
      await expect(
        // @ts-expect-error Row-only templates are not part of the public command API.
        f.runtime.commands.execute('entry.add', {
          kind: 'tasks',
          action: 'create',
          changes: { title: 'Bypass' },
        }),
      ).rejects.toThrow('No handler')
      await expect(
        f.runtime.commands.execute('entitySupporter.add', {
          kind: 'tasks',
          action: 'create',
          changes: { title: 'Bypass', status: 'invalid' },
        }),
      ).rejects.toThrow('does not accept')
      expect(f.db.select().from(tasks).all()).toEqual([])
    } finally {
      f.runtime.dispose()
    }
  })

  test('backend starts pause competing work, update saved membership and announce affected tasks', async () => {
    const f = await fixture()
    try {
      const first = await f.add('First')
      const second = await f.add('Second')
      await f.runtime.commands.execute('scheduler.generate', {
        date: '2026-11-02',
        timezone: 'UTC',
      })
      await f.transition(first.id, ProgressStatus.IN_PROGRESS)
      const started = f.now()
      f.advance(12)
      const announcements: MutationEvent[] = []
      f.runtime.events.on('tasks.change', (_name, event) => {
        announcements.push(event)
      })
      await f.transition(second.id, ProgressStatus.IN_PROGRESS, {
        spent_minutes: 500,
        started_at: 1,
      })
      expect(
        f.db.select().from(tasks).where(eq(tasks.id, first.id)).get(),
      ).toMatchObject({
        status: ProgressStatus.PAUSED,
        spent_minutes: 12,
        started_at: started,
      })
      expect(
        f.db.select().from(tasks).where(eq(tasks.id, second.id)).get(),
      ).toMatchObject({
        status: ProgressStatus.IN_PROGRESS,
        spent_minutes: 0,
        started_at: f.now(),
      })
      expect(
        f.db
          .select()
          .from(timeEntries)
          .where(isNull(timeEntries.end_time))
          .all()
          .map((row) => row.task_id),
      ).toEqual([second.id])
      expect(
        f.db
          .select()
          .from(planItems)
          .where(eq(planItems.sourceTaskId, first.id))
          .get()?.status,
      ).toBe(ProgressStatus.PAUSED)
      expect(
        announcements.some(
          (event) =>
            event.attachedIds?.includes(first.id) && event.result === undefined,
        ),
      ).toBe(true)
    } finally {
      f.runtime.dispose()
    }
  })

  test('a failure after tracking rolls back the competing pause, intervals and announcements', async () => {
    const f = await fixture()
    try {
      const first = await f.add('Still running', {
        status: ProgressStatus.IN_PROGRESS,
      })
      const second = await f.add('Rejected start')
      const before = f.db.select().from(timeEntries).all()
      f.advance(90)
      let events = 0
      f.runtime.events.onAny(() => {
        events++
      })
      await expect(
        f.transition(second.id, ProgressStatus.IN_PROGRESS, {
          tags: [{ title: 'rollback_domain_tag' }],
          urls: [{ url: 'invalid' }],
        }),
      ).rejects.toThrow()
      expect(f.db.select().from(timeEntries).all()).toEqual(before)
      expect(
        f.db.select().from(tasks).where(eq(tasks.id, first.id)).get(),
      ).toMatchObject({ status: ProgressStatus.IN_PROGRESS, spent_minutes: 0 })
      expect(
        f.db.select().from(tasks).where(eq(tasks.id, second.id)).get()?.status,
      ).toBe(ProgressStatus.PLANNED)
      expect(
        f.db
          .select()
          .from(tags)
          .where(eq(tags.title, 'rollback_domain_tag'))
          .all(),
      ).toEqual([])
      expect(events).toBe(0)
    } finally {
      f.runtime.dispose()
    }
  })

  test('one-offs and occurrences share exclusivity in both directions', async () => {
    const f = await fixture()
    try {
      const oneOff = await f.add('One off')
      const recurring = await f.add('Daily', {
        is_recurring: true,
        recurrance_rule: { type: 'daily', data: {} },
      })
      await f.runtime.commands.execute('scheduler.generate', {
        date: '2026-11-02',
        timezone: 'UTC',
      })
      const occurrence = f.db
        .select()
        .from(taskOccurrences)
        .where(eq(taskOccurrences.taskId, recurring.id))
        .get()!
      await f.transition(oneOff.id, ProgressStatus.IN_PROGRESS)
      f.advance(5)
      await f.runtime.commands.execute('scheduler.occurrence.transition', {
        id: occurrence.id,
        status: ProgressStatus.IN_PROGRESS,
      })
      expect(
        f.db.select().from(tasks).where(eq(tasks.id, oneOff.id)).get()?.status,
      ).toBe(ProgressStatus.PAUSED)
      expect(
        f.db
          .select()
          .from(planItems)
          .where(eq(planItems.sourceTaskId, oneOff.id))
          .get()?.status,
      ).toBe(ProgressStatus.PAUSED)
      f.advance(7)
      let occurrenceEvents = 0
      f.runtime.events.on('scheduler.occurrence.changed', () => {
        occurrenceEvents++
      })
      await f.transition(oneOff.id, ProgressStatus.IN_PROGRESS)
      expect(
        f.db
          .select()
          .from(taskOccurrences)
          .where(eq(taskOccurrences.id, occurrence.id))
          .get(),
      ).toMatchObject({ status: ProgressStatus.PAUSED, spentMinutes: 7 })
      expect(
        f.db
          .select()
          .from(timeEntries)
          .where(isNull(timeEntries.end_time))
          .all(),
      ).toHaveLength(1)
      expect(occurrenceEvents).toBe(1)
    } finally {
      f.runtime.dispose()
    }
  })

  test('a rejected occurrence or break leaves existing work running', async () => {
    const f = await fixture()
    try {
      const task = await f.add('Running', {
        status: ProgressStatus.IN_PROGRESS,
      })
      await f.runtime.commands.execute('scheduler.generate', {
        date: '2026-11-02',
        timezone: 'UTC',
      })
      await expect(
        f.runtime.commands.execute('scheduler.occurrence.transition', {
          id: 'missing',
          status: ProgressStatus.IN_PROGRESS,
        }),
      ).rejects.toThrow('Occurrence not found')
      await expect(
        f.runtime.commands.execute('scheduler.mode.change', {
          date: '2026-11-02',
          timezone: 'UTC',
          revision: 0,
          change: 'startBreak',
        }),
      ).rejects.toThrow('plan changed')
      expect(
        f.db.select().from(tasks).where(eq(tasks.id, task.id)).get()?.status,
      ).toBe(ProgressStatus.IN_PROGRESS)
      expect(
        f.db
          .select()
          .from(timeEntries)
          .where(isNull(timeEntries.end_time))
          .all(),
      ).toHaveLength(1)
    } finally {
      f.runtime.dispose()
    }
  })
})
