import { expect, test } from 'bun:test'
import { Priority, ProgressStatus } from '@c/types/enums'
import {
  itemKey,
  toTrackerItem,
  type TrackerItem,
} from '../../extensions/tracker/items'
import { nextItems } from '../../extensions/tracker/next-items'
import {
  parseTrackers,
  trackerErrors,
  type Tracker,
} from '../../extensions/tracker/trackers'
import { linkChanges } from '../../extensions/tracker/use-item-changes'

test('saved trackers must have a known type and sources; none saved is empty', () => {
  const reading: Tracker = {
    id: 'r',
    name: 'Reading',
    type: 'book',
    sources: [{ kind: 'areas', id: 'a', title: 'Reading' }],
  }
  expect(parseTrackers(undefined)).toEqual([])
  expect(parseTrackers([reading])).toEqual([reading])
  expect(() => parseTrackers([{ ...reading, type: 'film' }])).toThrow(
    'not valid',
  )
  expect(() =>
    parseTrackers([
      { ...reading, sources: [{ kind: 'tasks', id: 't', title: 'T' }] },
    ]),
  ).toThrow('not valid')
  expect(trackerErrors({ ...reading, name: ' ', sources: [] })).toEqual({
    name: 'Enter a tracker name.',
    sources: 'Pick at least one project, area, goal or tag.',
  })
})

const row = (changes: Record<string, unknown> = {}) => ({
  id: 'dune',
  title: 'Dune',
  status: ProgressStatus.PLANNED,
  priority: Priority.MEDIUM,
  due_date: null,
  created_at: 1,
  updated_at: 1,
  completed_at: null,
  spent_minutes: 30,
  progress_done: 0,
  progress_total: null,
  progress_unit: null,
  progress_input: null,
  custom_data: null,
  area_id: 'area',
  goal_id: 'goal',
  tags: [{ id: 'classic' }],
  ...changes,
})

test('items read their parent, tags and tracker data the same way for both kinds', () => {
  const project = toTrackerItem(
    'projects',
    row({ custom_data: { tracker: { rating: 4 }, kanban: { stage: 'x' } } }),
  )
  expect(project).toMatchObject({
    parentId: 'goal',
    tagIds: ['classic'],
    tracker: { rating: 4 },
  })
  expect(itemKey(project)).toBe('projects:dune')
  const goal = toTrackerItem('goals', row({ goal_id: undefined }))
  expect(goal.parentId).toBe('area')
  expect(
    toTrackerItem('goals', row({ custom_data: { tracker: 'x' } })).tracker,
  ).toEqual({ rating: undefined, summary: undefined })
})

const item = (id: string, changes: Partial<TrackerItem> = {}): TrackerItem => ({
  ...toTrackerItem('projects', row({ id, title: id })),
  ...changes,
})

test('the next item shares the parent, or a tag when there is none, best first', () => {
  const current = item('current', { status: ProgressStatus.COMPLETED })
  const items = [
    current,
    item('later', { due_date: 20 }),
    item('sooner', { due_date: 10 }),
    item('urgent', { priority: Priority.HIGH }),
    item('older', { created_at: 0 }),
    item('started', { status: ProgressStatus.IN_PROGRESS }),
    item('elsewhere', { parentId: 'other goal' }),
    item('a goal', { kind: 'goals' }),
  ]
  expect(nextItems(current, items).map(({ id }) => id)).toEqual([
    'sooner',
    'later',
    'urgent',
    'older',
  ])

  const loose = item('loose', { parentId: null, tagIds: ['classic', 'scifi'] })
  const byTag = [
    loose,
    item('tagged', { parentId: 'any', tagIds: ['scifi'] }),
    item('untagged', { parentId: null, tagIds: [] }),
  ]
  expect(nextItems(loose, byTag).map(({ id }) => id)).toEqual(['tagged'])
})

test('a handed-over task keeps its other link', () => {
  expect(linkChanges({ kind: 'projects', id: 'next' })).toEqual({
    project_id: 'next',
  })
  expect(linkChanges({ kind: 'goals', id: 'month' })).toEqual({
    goal_id: 'month',
  })
})
