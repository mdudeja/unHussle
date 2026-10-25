import { describe, expect, test } from 'bun:test'
import { resolveTaskSchedule, validateTaskSchedule } from '@c/taskSchedule'

const start = Date.UTC(2026, 9, 26, 9, 0)
const hour = 60 * 60_000

describe('resolveTaskSchedule', () => {
  test('derives end from start + estimate', () => {
    expect(
      resolveTaskSchedule({ scheduled_start: start, estimated_minutes: 60 }),
    ).toEqual({
      scheduled_start: start,
      scheduled_end: start + hour,
      estimated_minutes: 60,
    })
  })

  test('derives start from end + estimate', () => {
    expect(
      resolveTaskSchedule({
        scheduled_end: start + hour,
        estimated_minutes: 30,
      }).scheduled_start,
    ).toBe(start + hour / 2)
  })

  test('derives estimate from start + end', () => {
    expect(
      resolveTaskSchedule({
        scheduled_start: start,
        scheduled_end: start + 2 * hour,
        estimated_minutes: null,
      }).estimated_minutes,
    ).toBe(120)
  })

  test('keeps explicit values untouched', () => {
    const values = {
      scheduled_start: start,
      scheduled_end: start + hour,
      estimated_minutes: 15,
    }
    expect(resolveTaskSchedule(values)).toEqual(values)
  })

  test('leaves an incomplete schedule alone', () => {
    expect(resolveTaskSchedule({ scheduled_start: start })).toEqual({
      scheduled_start: start,
    })
    expect(resolveTaskSchedule({ estimated_minutes: 30 })).toEqual({
      estimated_minutes: 30,
    })
  })
})

describe('validateTaskSchedule', () => {
  test('rejects an end that is not after the start', () => {
    expect(
      validateTaskSchedule({ scheduled_start: start, scheduled_end: start }),
    ).toBeString()
    expect(
      validateTaskSchedule({
        scheduled_start: start,
        scheduled_end: start + 1,
      }),
    ).toBeUndefined()
  })
})
