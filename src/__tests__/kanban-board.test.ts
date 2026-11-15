import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'bun:test'
import { ProgressStatus } from '@c/types/enums'
import { kanbanExports } from '../../extensions/kanban/exports'

const { KanbanBoard, DEFAULT_STAGES } = kanbanExports
type Item = { id: string; column: number }

test('the board groups items by column, hides -1, and gives cards their neighbours', () => {
  const seen: Record<string, string[]> = {}
  const markup = renderToStaticMarkup(
    createElement(KanbanBoard<Item>, {
      items: [
        { id: 'book', column: 0 },
        { id: 'course', column: 1 },
        { id: 'hidden', column: -1 },
      ],
      stages: DEFAULT_STAGES,
      getId: (item) => item.id,
      columnFor: (item) => item.column,
      onMove: () => {},
      emptyText: 'No items',
      renderCard: (item, { previous, next }) => {
        seen[item.id] = [previous?.name ?? '-', next?.name ?? '-']
        return createElement('span', null, item.id)
      },
    }),
  )
  expect(seen).toEqual({
    book: ['-', 'In progress'],
    course: ['Planned', 'Completed'],
  })
  expect(markup).not.toContain('<span>hidden</span>')
  expect(markup).toContain('No items. Drag a card here to move it.')
  expect(DEFAULT_STAGES.map(({ status }) => status)).toEqual([
    ProgressStatus.PLANNED,
    ProgressStatus.IN_PROGRESS,
    ProgressStatus.COMPLETED,
  ])
})

test('stage errors need every status and unique names', () => {
  const { stageErrors } = kanbanExports
  expect(
    stageErrors([
      { name: 'Todo', status: ProgressStatus.PLANNED },
      { name: 'todo', status: ProgressStatus.IN_PROGRESS },
    ]),
  ).toEqual({
    stages: 'Add a stage for: Completed.',
    stageNames: [undefined, 'Use a different name for each stage.'],
  })
})
