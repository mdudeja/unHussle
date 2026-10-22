import { describe, test, expect } from 'bun:test'
import { Temporal } from 'temporal-polyfill'
import { getStartOfDayMillis } from '@c/datetimeUtils'
import { Priority } from '@c/types/index'
import { parseDataFromTaskInput } from '@/lib/inputParsers/parseDataFromTaskInput'
import type { Area, Goal, Project } from '@d/database/schemas'

const noEntities = {
  projects: [] as Project['Read'][],
  areas: [] as Area['Read'][],
  goals: [] as Goal['Read'][],
}

const parse = (input: string, entities: Partial<typeof noEntities> = {}) =>
  parseDataFromTaskInput({ input, ...noEntities, ...entities })

const now = Temporal.Now.plainDateISO()
const startOf = (date: Temporal.PlainDateLike) => getStartOfDayMillis(date)

describe('parseDataFromTaskInput', () => {
  test('returns sensible defaults for a plain title', () => {
    const result = parse('Buy milk')
    expect(result.task.title).toBe('Buy milk')
    expect(result.task.priority).toBe(Priority.MEDIUM)
    expect(result.task.is_fun).toBe(undefined)
    expect(result.task.is_chore).toBe(undefined)
    expect(result.task.is_quick).toBe(undefined)
    expect(result.urls).toEqual([])
    expect(result.tags).toEqual([])
  })

  test('extracts and removes a URL at the end of the input', () => {
    const result = parse('Buy milk https://example.com')
    expect(result.task.title).toBe('Buy milk')
    expect(result.urls).toEqual([{ url: 'https://example.com' }])
  })

  test('assigns an existing project matched by hashtag', () => {
    const result = parse('Task #proj due tomorrow', {
      projects: [{ id: 'p1', title: 'proj' } as Project['Read']],
    })
    expect(result.task.project_id).toBe('p1')
    expect(result.task.due_date).toBe(startOf(now.add({ days: 1 })))
  })

  test('assigns an existing area matched by hashtag', () => {
    const result = parse('Task #fitness please', {
      areas: [{ id: 'a1', title: 'fitness' } as Area['Read']],
    })
    expect(result.task.area_id).toBe('a1')
  })

  test('assigns an existing goal matched by hashtag', () => {
    const result = parse('Task #goals2026 please', {
      goals: [{ id: 'g1', title: 'goals2026' } as Goal['Read']],
    })
    expect(result.task.goal_id).toBe('g1')
  })

  test('collects unknown hashtags as tags', () => {
    const result = parse('Buy #shopping milk')
    expect(result.tags).toEqual([{ title: 'shopping' }])
    expect(result.task.title).toBe('Buy milk')
  })

  test('parses a due date that is not the last word', () => {
    const result = parse('Buy milk due tomorrow please')
    expect(result.task.due_date).toBe(startOf(now.add({ days: 1 })))
    expect(result.task.title).toBe('Buy milk')
  })

  test('parses a due date when it is the last word', () => {
    const result = parse('Buy milk due tomorrow')
    expect(result.task.due_date).toBe(startOf(now.add({ days: 1 })))
    expect(result.task.title).toBe('Buy milk')
  })

  test('parses estimated time in hours', () => {
    const result = parse('Write report est: 2h')
    expect(result.task.estimated_minutes).toBe(120)
    expect(result.task.title).toBe('Write report')
  })

  test('parses estimated time in minutes', () => {
    const result = parse('Write report est: 30m')
    expect(result.task.estimated_minutes).toBe(30)
    expect(result.task.title).toBe('Write report')
  })

  test('parses estimated time with hours and minutes', () => {
    const result = parse('Write report et: 1 hour 30 minutes')
    expect(result.task.estimated_minutes).toBe(90)
    expect(result.task.title).toBe('Write report')
  })

  test('parses a URL, a due date and an estimate together', () => {
    const result = parse('Buy milk due tomorrow est: 30m https://a.com')
    expect(result.task.title).toBe('Buy milk')
    expect(result.task.due_date).toBe(startOf(now.add({ days: 1 })))
    expect(result.task.estimated_minutes).toBe(30)
    expect(result.urls).toEqual([{ url: 'https://a.com' }])
  })
})
