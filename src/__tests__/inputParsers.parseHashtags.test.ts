import { describe, test, expect } from 'bun:test'
import { parseHashtags } from '@/lib/inputParsers/parseHashtags'
import type { Area, Goal, Project } from '@d/database/schemas'

const noEntities = {
  existingProjects: [] as Project['Read'][],
  existingAreas: [] as Area['Read'][],
  existingGoals: [] as Goal['Read'][],
}

// Collapses the whitespace that is inevitably left behind when hashtags are
// stripped, so assertions focus on content rather than stray spaces.
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim()

/** Parses hashtags from a text string. */
const parse = (text: string, entities: Partial<typeof noEntities> = {}) =>
  parseHashtags({ text, ...noEntities, ...entities })

/** Creates a project read representation containing its identifier and title. */
const project = (id: string, title: string) =>
  ({ id, title }) as Project['Read']
/** Creates the read representation of an area. */
const area = (id: string, title: string) => ({ id, title }) as Area['Read']
/** Creates a goal representation consisting of its identifier and title. */
const goal = (id: string, title: string) => ({ id, title }) as Goal['Read']

describe('parseHashtags', () => {
  test('extracts a hashtag in the middle of the text', () => {
    const result = parse('Buy #shopping milk')
    expect(result.tags).toEqual([{ title: 'shopping' }])
    expect(normalize(result.textWithoutTags)).toBe('Buy milk')
  })

  test('extracts a hashtag at the end of the text', () => {
    const result = parse('Buy milk #shopping')
    expect(result.tags).toEqual([{ title: 'shopping' }])
    expect(normalize(result.textWithoutTags)).toBe('Buy milk')
  })

  test('lowercases the extracted hashtags', () => {
    expect(parse('Task #Shopping now').tags).toEqual([{ title: 'shopping' }])
  })

  test('extracts multiple hashtags and de-duplicates them', () => {
    const result = parse('Task #one #two #one now')
    expect(result.tags).toEqual([{ title: 'one' }, { title: 'two' }])
  })

  test('matches an existing project by hashtag', () => {
    const result = parse('Task #shopping now', {
      existingProjects: [project('p1', 'shopping')],
    })
    expect(result.project_id).toBe('p1')
    expect(result.tags).toBeUndefined()
    expect(normalize(result.textWithoutTags)).toBe('Task now')
  })

  test('matches an existing area by hashtag', () => {
    const result = parse('Task #fitness now', {
      existingAreas: [area('a1', 'fitness')],
    })
    expect(result.area_id).toBe('a1')
  })

  test('matches an existing goal by hashtag', () => {
    const result = parse('Task #goals2026 now', {
      existingGoals: [goal('g1', 'goals2026')],
    })
    expect(result.goal_id).toBe('g1')
  })

  test('returns the text unchanged and no tags when there is no hashtag', () => {
    const result = parse('Buy milk')
    expect(result.tags).toBeUndefined()
    expect(result.textWithoutTags).toBe('Buy milk')
    expect(result.project_id).toBeUndefined()
    expect(result.area_id).toBeUndefined()
    expect(result.goal_id).toBeUndefined()
  })
})
