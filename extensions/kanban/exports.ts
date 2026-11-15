import {
  DEFAULT_STAGES,
  STAGE_STATUSES,
  STATUS_LABELS,
  stageErrors,
} from './boards'
import { KanbanBoard, MoveButton } from './kanban-board'
import { StageEditor } from './stage-editor'
import { boardStatus, columnFor, moveChanges } from './placement'

/**
 * What Kanban shares with extensions that require it. None of these use
 * Kanban's API, so they work inside any extension's views.
 */
export const kanbanExports = {
  version: 1,
  KanbanBoard,
  MoveButton,
  StageEditor,
  DEFAULT_STAGES,
  STAGE_STATUSES,
  STATUS_LABELS,
  stageErrors,
  boardStatus,
  columnFor,
  moveChanges,
} as const

/** Import as a type only: `api.dependencies.get<KanbanExports>('kanban')`. */
export type KanbanExports = typeof kanbanExports
export type { Stage, StageStatus } from './boards'
export type { KanbanBoardProps } from './kanban-board'
