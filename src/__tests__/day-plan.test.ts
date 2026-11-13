import { describe, expect, test } from 'bun:test'
import type { PlanEntry } from '@c/scheduler/contracts'
import { formatSpentTime } from '@c/datetimeUtils'
import {
  doneCountOf,
  entryTimeOf,
  groupEntries,
  isRunning,
  remainingMinutesOf,
} from '@/lib/day-plan'

const entry = (overrides: Partial<PlanEntry>) =>
  ({
    id: 'id',
    status: 'planned',
    fixedStart: null,
    fixedEnd: null,
    windowStart: null,
    windowEnd: null,
    ...overrides,
  }) as PlanEntry

describe('groupEntries', () => {
  test('orders appointments by start and keeps the stack order', () => {
    const groups = groupEntries([
      entry({ id: 'late', fixedStart: 2000 }),
      entry({ id: 'b' }),
      entry({ id: 'done', status: 'completed' }),
      entry({ id: 'early', fixedStart: 1000 }),
      entry({ id: 'a', status: 'in_progress' }),
    ])
    const ids = (list: PlanEntry[]) => list.map((item) => item.id)
    expect(ids(groups.appointments)).toEqual(['early', 'late'])
    expect(ids(groups.flexible)).toEqual(['b', 'a'])
    expect(ids(groups.finished)).toEqual(['done'])
  })
})

describe('entry status', () => {
  test('counts completed entries and spots the running one', () => {
    const entries = [
      entry({ status: 'completed' }),
      entry({ status: 'skipped' }),
      entry({ status: 'in_progress' }),
    ]
    expect(doneCountOf(entries)).toBe(1)
    expect(
      remainingMinutesOf([
        entry({ minutes: 30 }),
        entry({ status: 'in_progress', minutes: 10 }),
        entry({ status: 'completed', minutes: 99 }),
      ]),
    ).toBe(40)
    expect(entries.map(isRunning)).toEqual([false, false, true])
  })
})

describe('entryTimeOf', () => {
  test('shows an appointment slot, a window, or nothing', () => {
    const at = new Date(2026, 10, 13, 9, 0).getTime()
    const hour = 60 * 60 * 1000
    expect(entryTimeOf(entry({}))).toBeNull()
    expect(entryTimeOf(entry({ fixedStart: at, fixedEnd: at + hour }))).toBe(
      '09:00 - 10:00',
    )
    expect(entryTimeOf(entry({ windowStart: at }))).toBe('09:00')
  })
})

describe('formatSpentTime', () => {
  test('pluralises and leaves out empty minutes', () => {
    expect(formatSpentTime(0)).toBe('0 minutes')
    expect(formatSpentTime(1)).toBe('1 minute')
    expect(formatSpentTime(480)).toBe('8 hours')
    expect(formatSpentTime(65)).toBe('1 hour, 5 minutes')
  })
})
