import { expect, test } from 'bun:test'
import { ProgressInput, ProgressStatus } from '@c/types/enums'
import {
  DEFAULT_TYPES,
  defaultInput,
  parseTypes,
  typeErrors,
} from '../../extensions/tracker/item-types'
import { itemKey, toTrackedItem } from '../../extensions/tracker/items'
import { linkChanges } from '../../extensions/tracker/use-item-changes'

test('types default until saved, and a bad saved shape fails loudly', () => {
  expect(parseTypes(undefined)).toBe(DEFAULT_TYPES)
  expect(() => parseTypes([{ id: 'x', name: 'X' }])).toThrow('not valid')
  const podcast = {
    id: 'pod',
    name: 'Podcast',
    unit: 'episodes',
    input: ProgressInput.AMOUNT,
  }
  expect(parseTypes([podcast])).toEqual([podcast])
})

test('goals add up amounts by default; projects follow their type', () => {
  const book = DEFAULT_TYPES[0]
  expect(defaultInput('goals', book)).toBe(ProgressInput.AMOUNT)
  expect(defaultInput('projects', book)).toBe(ProgressInput.POSITION)
  expect(
    defaultInput('projects', { ...book, input: ProgressInput.AMOUNT }),
  ).toBe(ProgressInput.AMOUNT)
})

test('types need a unique name and a short unit', () => {
  expect(
    typeErrors([
      DEFAULT_TYPES[0],
      { ...DEFAULT_TYPES[1], name: 'book' },
      { ...DEFAULT_TYPES[2], unit: ' ' },
    ]).rows,
  ).toEqual([
    undefined,
    'Use a different name for each type.',
    'Enter a unit, such as pages.',
  ])
  expect(typeErrors([]).list).toBe('Add at least one type.')
})

const row = (custom_data: Record<string, unknown> | null) => ({
  id: 'dune',
  title: 'Dune',
  status: ProgressStatus.PLANNED,
  completed_at: null,
  progress_done: 0,
  progress_total: 350,
  progress_unit: 'pages',
  progress_input: ProgressInput.POSITION,
  custom_data,
})

test('tracked items read their data, and a malformed one shows as unknown', () => {
  const item = toTrackedItem(
    'projects',
    row({ tracker: { type: 'book', rating: 4 }, kanban: { stage: 'x' } }),
  )
  expect(item.tracker).toEqual({ type: 'book', rating: 4, summary: undefined })
  expect(itemKey(item)).toBe('projects:dune')
  expect(toTrackedItem('goals', row({ tracker: 'book' })).tracker.type).toBe('')
})

test('handing a task to a goal drops its project, so only the goal counts it', () => {
  expect(linkChanges({ kind: 'projects', id: 'next' })).toEqual({
    project_id: 'next',
  })
  expect(linkChanges({ kind: 'goals', id: 'month' })).toEqual({
    goal_id: 'month',
    project_id: null,
  })
})
