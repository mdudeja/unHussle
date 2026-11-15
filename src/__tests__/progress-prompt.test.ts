import { expect, test } from 'bun:test'
import { ProgressInput } from '@c/types/enums'
import {
  promptFields,
  promptValueError,
  promptValues,
  type CountingItem,
  type PromptField,
} from '@/lib/progress-prompt'

const item = (id: string, changes: Partial<CountingItem>): CountingItem => ({
  id,
  title: id,
  progress_done: 0,
  progress_total: 350,
  progress_unit: 'pages',
  progress_input: ProgressInput.POSITION,
  ...changes,
})
const field = (kind: 'projects' | 'goals', target: CountingItem): PromptField => ({
  session: { id: `${kind}-session`, kind, itemId: target.id },
  item: target,
})
const book = field('projects', item('Dune', { progress_done: 140 }))
const monthly = field(
  'goals',
  item('1000 pages', {
    progress_done: 780,
    progress_total: 1000,
    progress_input: ProgressInput.AMOUNT,
  }),
)

test('a goal with the same unit follows its project instead of asking again', () => {
  expect(promptFields([book, monthly])).toEqual({ asked: [book], following: [monthly] })
  expect(
    promptValues([book, monthly], { 'projects-session': 170 }),
  ).toEqual([
    { sessionId: 'projects-session', value: 170 },
    { sessionId: 'goals-session', value: 30 },
  ])
})

test('a goal with another unit asks for its own value', () => {
  const hours = field('goals', item('Study', { progress_unit: 'hours' }))
  expect(promptFields([book, hours]).asked).toEqual([book, hours])
})

test('entered values must be whole numbers within the total for positions', () => {
  expect(promptValueError(book.item, '')).toBe('Enter a whole number of 0 or more')
  expect(promptValueError(book.item, '1.5')).toBe('Enter a whole number of 0 or more')
  expect(promptValueError(book.item, '351')).toBe('Enter 350 or less')
  expect(promptValueError(monthly.item, '5000')).toBeNull()
})
