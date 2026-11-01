import { describe, test, expect } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import {
  getNow,
  getNowMillis,
  getStartOfDayMillis,
  getEndOfDayMillis,
  formatTimeDuration,
  formatDateTime,
  getLocalDateString,
  getDateTimeMillis,
  getDayBoundsMillis,
  getDateMinuteMillis,
  compareTimes,
  dateAndTimeToMillis,
} from '../datetimeUtils'

describe('datetimeUtils', () => {
  test('local dates use the requested timezone rather than the system timezone', () => {
    const instant = Date.UTC(2026, 10, 2, 1)
    expect(getLocalDateString(instant, 'America/Los_Angeles')).toBe(
      '2026-11-01',
    )
    expect(getLocalDateString(instant, 'Asia/Kolkata')).toBe('2026-11-02')
  })

  test('resolves wall-clock times in an explicit timezone and rejects invalid input', () => {
    expect(getDateTimeMillis('2026-11-02', '07:00', 'Asia/Kolkata')).toBe(
      Date.UTC(2026, 10, 2, 1, 30),
    )
    expect(() => getDateTimeMillis('2026-02-30', '07:00', 'UTC')).toThrow()
    expect(() => getDateTimeMillis('2026-11-02', '25:00', 'UTC')).toThrow()
    expect(() =>
      getDateTimeMillis('2026-11-02', '07:00', 'invalid/timezone'),
    ).toThrow()
  })

  test('day bounds are half-open and follow both DST transitions', () => {
    const [springStart, springEnd] = getDayBoundsMillis(
      '2026-03-08',
      'America/New_York',
    )
    const [fallStart, fallEnd] = getDayBoundsMillis(
      '2026-11-01',
      'America/New_York',
    )
    expect(springEnd - springStart).toBe(23 * 60 * 60 * 1000)
    expect(fallEnd - fallStart).toBe(25 * 60 * 60 * 1000)
    expect(fallEnd).toBe(Date.UTC(2026, 10, 2, 5))
    expect(getStartOfDayMillis('2026-11-01', 'America/New_York')).toBe(
      fallStart,
    )
    expect(getEndOfDayMillis('2026-11-01', 'America/New_York')).toBe(
      fallEnd - 1,
    )
  })

  test('time comparison parses values, including equivalent time representations', () => {
    expect(compareTimes('07:00', '23:00')).toBeLessThan(0)
    expect(compareTimes('07:00', '07:00:00')).toBe(0)
    expect(() => compareTimes('25:00', '07:00')).toThrow()
  })

  test('the existing Date-based conversion preserves local wall-clock behavior', () => {
    const instant = dateAndTimeToMillis(new Date(2026, 0, 1), '09:30')
    const local = new Date(instant)
    expect(local.getFullYear()).toBe(2026)
    expect(local.getMonth()).toBe(0)
    expect(local.getDate()).toBe(1)
    expect(local.getHours()).toBe(9)
    expect(local.getMinutes()).toBe(30)
  })
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

test('minute-of-day conversion follows local DST boundaries, including 1440', () => {
  const zone = 'America/New_York'
  const [start, end] = getDayBoundsMillis('2026-11-01', zone)
  expect(getDateMinuteMillis('2026-11-01', 0, zone)).toBe(start)
  expect(getDateMinuteMillis('2026-11-01', 1440, zone)).toBe(end)
  expect(getDateMinuteMillis('2026-11-01', 420, zone)).toBe(
    getDateTimeMillis('2026-11-01', '07:00', zone),
  )
  expect(() => getDateMinuteMillis('2026-11-01', 1441, zone)).toThrow()
})
