import {
  expandCandidates,
  occursOn,
  prepareCandidates,
} from '@c/scheduler/preparation'
import { validateSettings } from '@c/scheduler/validation'
import { planRuleRegistry } from '@c/scheduler/ruleRegistry'
import { isPending } from '@c/scheduler/status'
import { getDateTimeMillis, getDayBoundsMillis } from '@c/datetimeUtils'
import { describe, expect, test } from 'bun:test'
import { AnchorType, Priority, ProgressStatus } from '@c/types/enums'
import { buildDay, dayWindow, nextTask } from '@c/scheduler/engine'
import { dayModeOf, wrapUpReason } from '@c/scheduler/dayMode'
import {
  defaultSchedulerSettings,
  type PlanRuleName,
  type SchedulerSettings,
  type SchedulerTask,
} from '@c/scheduler/contracts'

const date = '2026-11-02'
const timezone = 'UTC'
const now = getDateTimeMillis(date, '07:00', timezone)
const settings = { ...defaultSchedulerSettings, overrides: {} }
function task(id: string, changes: Partial<SchedulerTask> = {}): SchedulerTask {
  return {
    id,
    title: id,
    description: null,
    custom_data: null,
    project_id: null,
    goal_id: null,
    area_id: null,
    status: ProgressStatus.PLANNED,
    priority: Priority.MEDIUM,
    anchor_id: null,
    anchor_type: AnchorType.any_after,
    anchor_slot: null,
    estimated_minutes: 30,
    spent_minutes: 0,
    due_date: null,
    is_recurring: false,
    recurrance_rule: null,
    is_fun: false,
    is_chore: false,
    is_quick: false,
    stack_order: 0,
    scheduled_start: null,
    scheduled_end: null,
    started_at: null,
    completed_at: null,
    created_at: 1,
    updated_at: 1,
    collectionPriorities: [null, null, null],
    isWork: false,
    ...changes,
  }
}
function plan(
  tasks: SchedulerTask[],
  extra: Partial<Omit<Parameters<typeof buildDay>[0], 'candidates'>> &
    Pick<
      Parameters<typeof prepareCandidates>[0],
      'excluded' | 'occurrences' | 'additionalItems'
    > = {},
) {
  const { excluded, occurrences, additionalItems, ...options } = extra
  const context = { date, timezone, now, settings, ...options }
  return buildDay({
    ...context,
    candidates: prepareCandidates({
      ...context,
      candidates: tasks.filter((task) => isPending(task.status ?? 'planned')),
      references: tasks.filter((task) => !isPending(task.status ?? 'planned')),
      excluded,
      occurrences,
      additionalItems,
    }),
  })
}

describe('Whole-day scheduler', () => {
  test('deadline urgency precedes task and collection priorities, with stable ties', () => {
    const result = plan([
      task('plain-high', { priority: Priority.HIGH }),
      task('collection-high', {
        collectionPriorities: [Priority.HIGH, null, null],
      }),
      task('normal'),
      task('due', { due_date: now, priority: Priority.LOW }),
      task('overdue', { due_date: now - 86400000, priority: Priority.LOW }),
    ])
    expect(result.entries.map((i) => i.id)).toEqual([
      'overdue',
      'due',
      'plain-high',
      'collection-high',
      'normal',
    ])
    expect(plan([task('b'), task('a')]).entries.map((i) => i.id)).toEqual([
      'a',
      'b',
    ])
  })
  test('fills capacity, counts work separately, and retains urgent over-budget work', () => {
    const limited: SchedulerSettings = {
      ...settings,
      wake: '07:00',
      sleep: '09:00',
      workMinutes: 30,
    }
    const result = plan(
      [
        task('work', { isWork: true }),
        task('extra-work', { isWork: true, created_at: 2 }),
        task('walk'),
        task('urgent-work', {
          isWork: true,
          due_date: now,
          estimated_minutes: 45,
        }),
      ],
      { settings: limited },
    )
    expect(result.entries.some((i) => i.id === 'urgent-work')).toBe(true)
    expect(result.entries.some((i) => i.id === 'walk')).toBe(true)
    expect(result.entries.some((i) => i.id === 'extra-work')).toBe(false)
    expect(result.conflicts.some((c) => c.includes('work limit'))).toBe(true)
  })
  test('uses explicit estimates ahead of quick defaults and subtracts already spent effort', () => {
    const items = expandCandidates(
      [
        task('quick', { is_quick: true, estimated_minutes: null }),
        task('spent', { estimated_minutes: 60, spent_minutes: 20 }),
      ],
      date,
      timezone,
      settings,
    )
    expect(items.map((i) => i.minutes)).toEqual([5, 40])
  })
  test('starter cues lead with a quick or fun task, but not ahead of urgent work', () => {
    const result = plan([
      task('long-a', { estimated_minutes: 60 }),
      task('long-b', { estimated_minutes: 60 }),
      task('starter', { is_fun: true, estimated_minutes: 10, created_at: 0 }),
      task('quick', { is_quick: true, estimated_minutes: 5 }),
    ])
    expect(result.entries.map((i) => i.id)).toEqual([
      'starter',
      'long-a',
      'quick',
      'long-b',
    ])
    const urgent = plan([
      task('fun', { is_fun: true, estimated_minutes: 5 }),
      task('urgent', { due_date: now }),
    ])
    // The starter goes first; urgent work follows it and stays in the stack.
    expect(urgent.entries.map((i) => i.id)).toEqual(['urgent', 'fun'])
    expect(urgent.entries[0].reason).toBe('Due today')
    // After a break the stack leads with something easy, not a chore.
    const back = plan(
      [
        task('normal'),
        task('chore', { is_chore: true, estimated_minutes: 5 }),
        task('fun', { is_fun: true, estimated_minutes: 5 }),
      ],
      { cue: 'break' },
    )
    expect(back.entries[0].id).toBe('fun')
    expect(back.entries[0].reason).toBe('An easy way back in after your break')
  })
  test('keeps fixed times and picks a task that fits before the appointment', () => {
    const result = plan([
      task('long', { estimated_minutes: 90 }),
      task('short', { estimated_minutes: 10 }),
      task('meeting', {
        scheduled_start: now + 15 * 60000,
        scheduled_end: now + 45 * 60000,
      }),
    ])
    expect(nextTask(result, now).item?.id).toBe('short')
    expect(nextTask(result, now + 15 * 60000).item?.id).toBe('meeting')
    expect(result.entries.find((i) => i.id === 'long')?.fixedStart).toBeNull()
  })
  test('reports overlapping appointments, retains both, and leaves active work in focus', () => {
    const result = plan([
      task('active', { status: ProgressStatus.IN_PROGRESS }),
      task('a', { scheduled_start: now, scheduled_end: now + 60000 }),
      task('b', { scheduled_start: now, scheduled_end: now + 60000 }),
    ])
    expect(result.entries).toHaveLength(3)
    expect(result.conflicts.some((c) => c.includes('overlapping'))).toBe(true)
    expect(nextTask(result, now).item?.id).toBe('active')
    expect(nextTask(result, now).upcoming).not.toBeNull()
  })
  test('orders adjacency chains and prevents starting a dependent first', () => {
    const result = plan([
      task('first'),
      task('last', { anchor_id: 'middle', anchor_type: AnchorType.after }),
      task('middle', { anchor_id: 'first', anchor_type: AnchorType.after }),
    ])
    expect(result.entries.map((i) => i.id)).toEqual(['first', 'middle', 'last'])
    expect(result.conflicts).toEqual([])
    expect(nextTask(result, now, 'first').item).toBeNull()
  })
  test('satisfies after anchors whose one-off anchor is already completed', () => {
    const result = plan([
      task('done', { status: ProgressStatus.COMPLETED }),
      task('next', { anchor_id: 'done', anchor_type: AnchorType.after }),
    ])
    expect(nextTask(result, now).item?.id).toBe('next')
    expect(result.conflicts).toEqual([])
  })
  test('cyclic occurrence dependencies do not block unrelated suggestions', () => {
    const result = plan([
      task('a', { anchor_id: 'b' }),
      task('b', { anchor_id: 'a' }),
      task('unrelated'),
    ])
    expect(result.entries.map((item) => item.id)).toEqual(['unrelated'])
    expect(result.conflicts.some((message) => message.includes('cyclic'))).toBe(
      true,
    )
  })
  test('unavailable anchors block dependent suggestions and explain why', () => {
    const result = plan([task('blocked', { anchor_id: 'missing' })])
    expect(result.entries).toHaveLength(0)
    expect(result.conflicts[0]).toContain('anchor')
  })
  test('completed and excluded tasks do not return on a replan', () => {
    expect(
      plan(
        [task('done', { status: ProgressStatus.COMPLETED }), task('deferred')],
        { excluded: new Set(['deferred']) },
      ).entries,
    ).toEqual([])
  })
  test('reserves recurring capacity before ordinary tasks, without overfilling the day', () => {
    const result = plan(
      [
        task('a'),
        task('b'),
        task('habit', {
          estimated_minutes: 5,
          is_recurring: true,
          recurrance_rule: { type: 'daily', data: {} },
        }),
      ],
      { settings: { ...settings, sleep: '08:00' } },
    )
    expect(result.entries).toHaveLength(2)
    expect(result.conflicts).toEqual([])
  })
  test('an adjacent chain must fit as a whole before another appointment', () => {
    const result = plan([
      task('first', { estimated_minutes: 10 }),
      task('second', {
        estimated_minutes: 10,
        anchor_id: 'first',
        anchor_type: AnchorType.after,
      }),
      task('meeting', {
        scheduled_start: now + 15 * 60000,
        scheduled_end: now + 30 * 60000,
      }),
      task('small', { estimated_minutes: 5 }),
    ])
    expect(nextTask(result, now).item?.id).toBe('small')
  })
  test('multi-slot recurring tasks have independent capacity windows and explicit anchor slot selection', () => {
    const habit = task('habit', {
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
    const result = plan([
      habit,
      task('after-evening', {
        estimated_minutes: 5,
        anchor_id: 'habit',
        anchor_slot: 2,
        anchor_type: AnchorType.after,
      }),
    ])
    expect(result.conflicts).toEqual([])
    expect(nextTask(result, now).item?.id).toBe(`habit:${date}:0`)
    expect(nextTask(result, now, `habit:${date}:0`).item).toBeNull()
  })
  test('conflicting adjacency requirements are explained and not silently suggested', () => {
    const result = plan([
      task('a'),
      task('b', { anchor_id: 'a', anchor_type: AnchorType.after }),
      task('c', { anchor_id: 'a', anchor_type: AnchorType.after }),
    ])
    expect(result.entries).toHaveLength(0)
    expect(result.conflicts.length).toBeGreaterThan(0)
  })
})

describe('Recurring expansion and local dates', () => {
  test('creates independent occurrences for morning and evening, not early evening suggestions', () => {
    const habit = task('teeth', {
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
      estimated_minutes: 3,
    })
    const result = plan([habit])
    expect(result.entries.map((i) => i.id)).toEqual([
      `teeth:${date}:0`,
      `teeth:${date}:1`,
    ])
    expect(nextTask(result, now).item?.id).toBe(`teeth:${date}:0`)
    result.entries[0].status = 'completed'
    expect(nextTask(result, now).item).toBeNull()
    expect(
      nextTask(result, getDateTimeMillis(date, '20:00', timezone)).item?.id,
    ).toBe(`teeth:${date}:1`)
    expect(plan([habit], { date: '2026-11-03' }).entries).toHaveLength(2)
  })
  test('DST days use actual elapsed time, not a fixed 24-hour duration', () => {
    const [start, end] = getDayBoundsMillis('2026-11-01', 'America/New_York')
    expect(end - start).toBe(25 * 60 * 60 * 1000)
  })
})

test('scheduling preserves prepared inputs while applying starter preferences', () => {
  const prepared = prepareCandidates({
    candidates: [
      task('long'),
      task('starter', { is_fun: true, estimated_minutes: 5 }),
    ],
    date,
    timezone,
    settings,
  })
  const before = structuredClone(prepared)
  const result = buildDay({
    candidates: prepared,
    date,
    timezone,
    now,
    settings,
  })
  expect(result.entries[0].id).toBe('starter')
  expect(prepared).toEqual(before)
})

test('completed occurrence anchors unlock dependents while cancelled anchors do not', () => {
  const habit = task('habit', {
    is_recurring: true,
    recurrance_rule: { type: 'daily', data: {} },
  })
  const dependent = task('dependent', {
    anchor_id: habit.id,
    anchor_type: AnchorType.after,
  })
  const prepared = prepareCandidates({
    candidates: [habit, dependent],
    date,
    timezone,
    settings,
  })
  prepared.find((entry) => entry.taskId === habit.id)!.status = 'completed'
  expect(
    nextTask(
      buildDay({ candidates: prepared, date, timezone, now, settings }),
      now,
    ).item?.id,
  ).toBe('dependent')
  prepared.find((entry) => entry.taskId === habit.id)!.status = 'cancelled'
  expect(
    buildDay({ candidates: prepared, date, timezone, now, settings }).entries,
  ).toEqual([])
})

describe('Scheduling rules', () => {
  const hour = { ...settings, sleep: '08:00' }
  const competing = [
    task('high', { priority: Priority.HIGH, estimated_minutes: 40 }),
    task('due', {
      priority: Priority.LOW,
      estimated_minutes: 40,
      due_date: now + 10 * 86400000,
    }),
  ]
  test('the registry order decides which candidates win limited capacity', () => {
    expect(
      plan(competing, { settings: hour }).entries.map((entry) => entry.id),
    ).toEqual(['high'])
    const dueFirst = buildDay(
      {
        candidates: prepareCandidates({
          candidates: competing,
          date,
          timezone,
          settings: hour,
        }),
        date,
        timezone,
        now,
        settings: hour,
      },
      {
        ...planRuleRegistry,
        fresh: ['dueDateRanking', 'priorityRanking'],
      },
    )
    expect(dueFirst.entries.map((entry) => entry.id)).toEqual(['due'])
    expect(dueFirst.entries[0].reason).toBe('Earliest due date')
  })
  test('settings override a cue’s rules, and unknown rules are skipped', () => {
    const overridden = plan(competing, {
      settings: {
        ...hour,
        rules: { fresh: ['unknown' as PlanRuleName, 'dueDateRanking'] },
      },
    })
    expect(overridden.entries.map((entry) => entry.id)).toEqual(['due'])
    expect(() =>
      validateSettings({
        ...settings,
        rules: { fresh: ['unknown' as PlanRuleName] },
      }),
    ).toThrow('Unknown scheduling rule')
    expect(() =>
      validateSettings({ ...settings, rules: { fresh: ['oldestFirst'] } }),
    ).not.toThrow()
  })
  test('appointments and active work stay even when no rule picks them', () => {
    const result = plan(
      [
        task('active', { status: ProgressStatus.IN_PROGRESS }),
        task('meeting', { scheduled_start: now, scheduled_end: now + 60000 }),
        task('ordinary'),
      ],
      { settings: { ...settings, rules: { fresh: [] } } },
    )
    expect(result.entries.map((entry) => entry.id).sort()).toEqual([
      'active',
      'meeting',
    ])
    expect(result.backlogCount).toBe(1)
  })
  test('arrangers cannot split an adjacent anchor chain', () => {
    const result = plan([
      task('a', { estimated_minutes: 60 }),
      task('b', {
        estimated_minutes: 60,
        anchor_id: 'a',
        anchor_type: AnchorType.after,
      }),
      task('quick', { is_quick: true, estimated_minutes: 5, created_at: 2 }),
    ])
    expect(result.entries.map((entry) => entry.id)).toEqual(['a', 'b', 'quick'])
    expect(result.conflicts).toEqual([])
  })
  test('required urgent work over capacity stays visible with a conflict', () => {
    const result = plan(
      [task('urgent', { due_date: now, estimated_minutes: 90 })],
      { settings: hour },
    )
    expect(result.entries.map((entry) => entry.id)).toEqual(['urgent'])
    expect(result.entries[0].reason).toBe('Due today')
    expect(result.conflicts.some((c) => c.includes('capacity'))).toBe(true)
  })
})

describe('Day windows and recurrence dates', () => {
  test('today starts now, other days at wake, and overrides apply', () => {
    const later = getDateTimeMillis(date, '09:00', timezone)
    expect(dayWindow(date, timezone, later, settings).capacityMinutes).toBe(
      14 * 60,
    )
    const override = {
      ...settings,
      overrides: {
        '2026-11-03': { wake: '10:00', sleep: '12:00', workMinutes: 60 },
      },
    }
    expect(dayWindow('2026-11-03', timezone, later, override)).toMatchObject({
      capacityMinutes: 120,
      workLimit: 60,
    })
  })
  test('month ends, leap days and removed slots', () => {
    const monthly = task('monthly', {
      is_recurring: true,
      recurrance_rule: {
        type: 'monthly',
        data: { weekDays: [], monthDays: [31] },
      },
    })
    expect(occursOn(monthly, '2026-11-30', timezone)).toBe(false)
    expect(occursOn(monthly, '2026-12-31', timezone)).toBe(true)
    const leap = task('leap', {
      is_recurring: true,
      recurrance_rule: {
        type: 'yearly',
        data: { weekDays: [], monthDays: [29], months: [2] },
      },
    })
    expect(occursOn(leap, '2028-02-29', timezone)).toBe(true)
    expect(occursOn(leap, '2027-02-28', timezone)).toBe(false)
    const daily = task('daily', {
      is_recurring: true,
      recurrance_rule: { type: 'daily', data: {} },
    })
    expect(occursOn(daily, date, timezone, 0)).toBe(true)
    expect(occursOn(daily, date, timezone, 1)).toBe(false)
    expect(occursOn(task('one-off'), date, timezone)).toBe(false)
  })
})

test('paused one-off work resumes before new work of the same priority, but not over urgency', () => {
  const hour = { ...settings, sleep: '08:00' }
  const result = plan(
    [
      task('old-a', { created_at: 0 }),
      task('old-b', { created_at: 0 }),
      task('half-done', {
        status: ProgressStatus.PAUSED,
        estimated_minutes: 60,
        spent_minutes: 30,
        created_at: 5,
      }),
    ],
    { settings: hour },
  )
  expect(result.entries.map((i) => i.id)).toEqual(['half-done', 'old-a'])
  expect(result.entries[0].reason).toBe('You started this earlier')

  const urgent = plan(
    [
      task('due', { due_date: now }),
      task('half-done', { status: ProgressStatus.PAUSED, created_at: 5 }),
    ],
    { settings: { ...settings, sleep: '07:40' } },
  )
  expect(urgent.entries.map((i) => i.id)).toContain('due')
})

describe('Day modes', () => {
  const saved = (
    tasks: SchedulerTask[],
    extra: Parameters<typeof plan>[1] = {},
  ) => ({ ...plan(tasks, extra), saved: true })

  test('do something else skips several tasks in stack order', () => {
    const result = plan([
      task('a', { created_at: 1 }),
      task('b', { created_at: 2 }),
      task('c', { created_at: 3 }),
    ])
    expect(nextTask(result, now, new Set(['a'])).item?.id).toBe('b')
    expect(nextTask(result, now, new Set(['a', 'b'])).item?.id).toBe('c')
    expect(nextTask(result, now, new Set(['a', 'b', 'c'])).item).toBeNull()
  })

  test('wrapping up keeps active work, appointments and pins, then only chores', () => {
    const result = plan(
      [
        task('active', { status: ProgressStatus.IN_PROGRESS }),
        task('meeting', {
          scheduled_start: now + 60 * 60000,
          scheduled_end: now + 90 * 60000,
        }),
        task('urgent', { due_date: now }),
        task('dishes', { is_chore: true }),
      ],
      { cue: 'wrap' },
    )
    expect(result.entries.map((i) => i.id).sort()).toEqual(
      ['active', 'dishes', 'meeting'].sort(),
    )
    expect(result.entries.find((i) => i.id === 'dishes')?.reason).toBe(
      'A chore to wrap up the day',
    )
  })

  test('wrap-up and pulling more still fit work after wind-down', () => {
    const late = getDateTimeMillis(date, '23:10', timezone)
    const chores = [task('dishes', { is_chore: true, estimated_minutes: 10 })]
    expect(plan(chores, { now: late }).entries).toHaveLength(0)
    expect(plan(chores, { now: late, cue: 'wrap' }).entries).toHaveLength(1)
    expect(plan(chores, { now: late, cue: 'more' }).entries).toHaveLength(1)
    expect(
      dayWindow(date, timezone, late, settings, { pastWindDown: true })
        .capacityMinutes,
    ).toBe(50)
  })

  test('wrap-up starts within the lead time of wind-down, but not after it', () => {
    const tasks = [task('a'), task('b')]
    const before = getDateTimeMillis(date, '22:29', timezone)
    const within = getDateTimeMillis(date, '22:31', timezone)
    const after = getDateTimeMillis(date, '23:01', timezone)
    expect(wrapUpReason(saved(tasks), before)).toBeNull()
    expect(wrapUpReason(saved(tasks), within)).toBe('windDown')
    expect(wrapUpReason(saved(tasks), after)).toBeNull()
  })

  test('wrap-up starts with the last task: at once when short, near its end when long', () => {
    const short = saved([
      task('last', { status: ProgressStatus.IN_PROGRESS }),
      task('chore', { is_chore: true }),
    ])
    expect(wrapUpReason(short, now)).toBe('lastTask')

    const long = saved([
      task('last', {
        status: ProgressStatus.IN_PROGRESS,
        estimated_minutes: 90,
      }),
    ])
    expect(wrapUpReason(long, now)).toBeNull()
    const nearlyDone = {
      ...long,
      entries: long.entries.map((entry) => ({ ...entry, minutes: 25 })),
    }
    expect(wrapUpReason(nearlyDone, now)).toBe('lastTask')

    const notLast = saved([
      task('current', { status: ProgressStatus.IN_PROGRESS }),
      task('next'),
    ])
    expect(wrapUpReason(notLast, now)).toBeNull()
  })

  test('wrap-up never starts on its own during a break, twice, or after pulling more', () => {
    const base = saved([task('last', { status: ProgressStatus.IN_PROGRESS })])
    expect(wrapUpReason({ ...base, breakStartedAt: now }, now)).toBeNull()
    expect(wrapUpReason({ ...base, wrapReason: 'manual' }, now)).toBeNull()
    expect(wrapUpReason({ ...base, autoWrap: false }, now)).toBeNull()
    expect(dayModeOf({ breakStartedAt: now, wrapReason: 'manual' })).toBe(
      'break',
    )
    expect(dayModeOf({ breakStartedAt: null, wrapReason: 'lastTask' })).toBe(
      'wrap',
    )
  })
})
