import { describe, test, expect } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { getStartOfDayMillis } from '@c/datetimeUtils'
import { parseDueDate } from '@/lib/inputParsers/parseDueDate'

const now = Temporal.Now.plainDateISO()
/** Returns the start of the day for the given date. */
const startOf = (date: Temporal.PlainDateLike) => getStartOfDayMillis(date)

// Mirrors the intended rule: use the current year, rolling to next year when
// the date has already passed.
const expectedMonthDay = (month: number, day: number) => {
  let year = now.year
  const candidate = Temporal.PlainDate.from({ year, month, day })
  if (Temporal.PlainDate.compare(candidate, now) < 0) {
    year += 1
  }
  return startOf({ year, month, day })
}

describe('parseDueDate', () => {
  test('returns undefined when there is no due phrase', () => {
    expect(parseDueDate('do the dishes')).toBeUndefined()
    expect(parseDueDate('')).toBeUndefined()
  })

  test('parses "due today"', () => {
    expect(parseDueDate('due today')).toBe(startOf(now))
  })

  test('parses "due tomorrow"', () => {
    expect(parseDueDate('due tomorrow')).toBe(startOf(now.add({ days: 1 })))
  })

  test('is case-insensitive', () => {
    expect(parseDueDate('DUE TOMORROW')).toBe(startOf(now.add({ days: 1 })))
  })

  test('parses "due this week" as the coming Sunday', () => {
    expect(parseDueDate('due this week')).toBe(
      startOf(now.add({ days: 7 - now.dayOfWeek })),
    )
  })

  test('parses "due end of the month" and "due month end"', () => {
    const endOfMonth = startOf(now.with({ day: now.daysInMonth }))
    expect(parseDueDate('due end of the month')).toBe(endOfMonth)
    expect(parseDueDate('due month end')).toBe(endOfMonth)
  })

  test('parses "due next <weekday>" as the following week', () => {
    const weekday = now.toLocaleString('en-US', { weekday: 'long' })
    expect(parseDueDate(`due next ${weekday}`)).toBe(
      startOf(now.add({ days: 7 })),
    )
  })

  test('parses "due this <weekday>" as this week occurrence', () => {
    const weekday = now.toLocaleString('en-US', { weekday: 'long' })
    expect(parseDueDate(`due this ${weekday}`)).toBe(startOf(now))
  })

  test('parses an explicit DD/MM/YYYY date', () => {
    expect(parseDueDate('due 25/12/2026')).toBe(
      startOf(Temporal.PlainDate.from({ year: 2026, month: 12, day: 25 })),
    )
  })

  test('parses a DD/MM date using the current year', () => {
    expect(parseDueDate('due 25/12')).toBe(
      startOf({ year: now.year, month: 12, day: 25 }),
    )
  })

  test('returns undefined for an impossible DD/MM/YYYY date', () => {
    expect(parseDueDate('due 32/13/2026')).toBeUndefined()
  })

  test('parses "due 15th March" (day before month)', () => {
    expect(parseDueDate('due 15th March')).toBe(expectedMonthDay(3, 15))
    expect(parseDueDate('due 15 March')).toBe(expectedMonthDay(3, 15))
  })

  test('parses "due March 15th" (month before day)', () => {
    expect(parseDueDate('due March 15th')).toBe(expectedMonthDay(3, 15))
    expect(parseDueDate('due March 15')).toBe(expectedMonthDay(3, 15))
  })
})
