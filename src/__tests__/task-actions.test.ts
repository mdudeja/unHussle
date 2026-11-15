import { expect, test } from 'bun:test'
import { ProgressStatus } from '@c/types/enums'
import { useTaskActions, visibleActions } from '@/lib/entityActions'

const useShownActions = (task: {
  status: ProgressStatus
  is_recurring: boolean
}) =>
  visibleActions(useTaskActions(), {
    id: 'read',
    timeEntries: [],
    ...task,
  }).map(({ id }) => id)

test('a recurring task completes or cancels, but is never started itself', () => {
  expect(
    useShownActions({ status: ProgressStatus.PLANNED, is_recurring: true }),
  ).toEqual(['complete', 'cancel'])
  expect(
    useShownActions({ status: ProgressStatus.PLANNED, is_recurring: false }),
  ).toEqual(['start', 'complete', 'cancel'])
  expect(
    useShownActions({
      status: ProgressStatus.IN_PROGRESS,
      is_recurring: false,
    }),
  ).toEqual(['pause', 'complete', 'cancel'])
})
