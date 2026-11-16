import { expect, test } from 'bun:test'
import { ProgressStatus } from '@c/types/enums'
import { DEFAULT_STAGES, type Stage } from '../../extensions/kanban/boards'
import {
  columnFor,
  completeChanges,
  moveChanges,
  startChanges,
} from '../../extensions/kanban/placement'

const review: Stage = { name: 'Review', status: ProgressStatus.IN_PROGRESS }
// Planned, In progress, Review, Completed
const stages = [...DEFAULT_STAGES.slice(0, 2), review, DEFAULT_STAGES[2]]
const task = (status: ProgressStatus, stage?: string) => ({
  title: stage ? `[${stage}] Task` : 'Task',
  status,
  custom_data: stage ? { kanban: { stage }, other: {} } : null,
})

test('tasks sit in their saved stage, else the first stage of their status', () => {
  expect(columnFor(task(ProgressStatus.PLANNED), stages)).toBe(0)
  expect(columnFor(task(ProgressStatus.IN_PROGRESS, 'Review'), stages)).toBe(2)
  expect(columnFor(task(ProgressStatus.PAUSED, 'Review'), stages)).toBe(2)
  expect(columnFor(task(ProgressStatus.PAUSED), stages)).toBe(1)
  // A stage that was renamed, or one of another status, is ignored.
  expect(columnFor(task(ProgressStatus.IN_PROGRESS, 'Gone'), stages)).toBe(1)
  expect(columnFor(task(ProgressStatus.COMPLETED, 'Review'), stages)).toBe(3)
  expect(columnFor(task(ProgressStatus.CANCELLED), stages)).toBe(-1)
})

test("moving saves only Kanban's stage and changes the status only when needed", () => {
  expect(
    moveChanges(task(ProgressStatus.PAUSED, 'In progress'), review),
  ).toEqual({
    title: '[Review] Task',
    custom_data: { kanban: { stage: 'Review' } },
  })
  expect(moveChanges(task(ProgressStatus.PLANNED), review)).toEqual({
    title: '[Review] Task',
    custom_data: { kanban: { stage: 'Review' } },
    status: ProgressStatus.IN_PROGRESS,
  })
  expect(moveChanges(task(ProgressStatus.IN_PROGRESS), stages[0])).toEqual({
    title: '[Planned] Task',
    custom_data: { kanban: { stage: 'Planned' } },
    status: ProgressStatus.PLANNED,
  })
})

test('starting moves planned tasks forward; completing moves to the first completed stage', () => {
  expect(startChanges(task(ProgressStatus.PLANNED), stages)).toEqual({
    title: '[In progress] Task',
    custom_data: { kanban: { stage: 'In progress' } },
    status: ProgressStatus.IN_PROGRESS,
  })
  expect(startChanges(task(ProgressStatus.PAUSED, 'Review'), stages)).toEqual({
    title: '[Review] Task',
    custom_data: { kanban: { stage: 'Review' } },
    status: ProgressStatus.IN_PROGRESS,
  })
  expect(
    completeChanges(task(ProgressStatus.IN_PROGRESS, 'Review'), stages),
  ).toEqual({
    title: 'Task',
    custom_data: { kanban: { stage: 'Completed' } },
    status: ProgressStatus.COMPLETED,
  })
})
