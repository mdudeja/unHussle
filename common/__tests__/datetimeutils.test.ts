import { describe, test, expect } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import {
  getNow,
  getNowMillis,
  getStartOfDayMillis,
  getEndOfDayMillis,
  formatTimeDuration,
  formatDateTime,
} from '../datetimeUtils'

describe('datetimeUtils', () => {
  test('getNow returns current instant', () => {
    const now = getNow()
    expect(now).toBeInstanceOf(Temporal.Instant)
  })

  test('getNowMillis returns current milliseconds', () => {
    const nowMillis = getNowMillis()
    expect(typeof nowMillis).toBe('number')
  })

  test('getStartOfDayMillis returns start of day milliseconds', () => {
    const date = Temporal.PlainDate.from('2024-06-15')
    const startOfDayMillis = getStartOfDayMillis(date)
    const expected = Temporal.ZonedDateTime.from({
      year: 2024,
      month: 6,
      day: 15,
      hour: 0,
      minute: 0,
      second: 0,
      timeZone: Temporal.Now.timeZoneId(),
    }).toInstant().epochMilliseconds
    expect(startOfDayMillis).toBe(expected)
  })

  test('getEndOfDayMillis returns end of day milliseconds', () => {
    const date = Temporal.PlainDate.from('2024-06-15')
    const endOfDayMillis = getEndOfDayMillis(date)
    const expected = Temporal.ZonedDateTime.from({
      year: 2024,
      month: 6,
      day: 15,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
      timeZone: Temporal.Now.timeZoneId(),
    }).toInstant().epochMilliseconds
    expect(endOfDayMillis).toBe(expected)
  })

  test('formatTimeDuration formats duration correctly', () => {
    expect(formatTimeDuration(3661)).toBe('1:01:01')
    expect(formatTimeDuration(61)).toBe('01:01')
    expect(formatTimeDuration(1)).toBe('00:01')
    expect(formatTimeDuration(0)).toBe('00:00')
  })

  test('formatDateTime formats milliseconds to date-time string', () => {
    const millis = Temporal.ZonedDateTime.from({
      year: 2024,
      month: 6,
      day: 15,
      hour: 12,
      minute: 30,
      second: 0,
      timeZone: Temporal.Now.timeZoneId(),
    }).toInstant().epochMilliseconds
    const formatted = formatDateTime(millis)
    expect(formatted).toContain('2024-06-15T12:30:00')
  })
})
