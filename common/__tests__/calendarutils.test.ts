import { describe, expect, test } from 'bun:test'
import {
  addDaysToDate,
  getWeekStartDate,
  parseCalendarDate,
} from '@c/calendarUtils'

describe('calendar date utilities', () => {
  test('calendar arithmetic crosses leap days, month ends, and year boundaries', () => {
    expect(addDaysToDate('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDaysToDate('2027-02-28', 1)).toBe('2027-03-01')
    expect(addDaysToDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysToDate('2026-01-01', -1)).toBe('2025-12-31')
  })

  test('week starts are Monday, including across year boundaries', () => {
    expect(getWeekStartDate('2026-11-02')).toBe('2026-11-02')
    expect(getWeekStartDate('2026-11-08')).toBe('2026-11-02')
    expect(getWeekStartDate('2026-01-01')).toBe('2025-12-29')
  })

  test('parsing validates dates and exposes calendar fields for recurrence matching', () => {
    const date = parseCalendarDate('2026-11-02')
    expect(date.year).toBe(2026)
    expect(date.month).toBe(11)
    expect(date.day).toBe(2)
    expect(date.dayOfWeek).toBe(1)
    expect(() => parseCalendarDate('2026-02-30')).toThrow()
  })
})
