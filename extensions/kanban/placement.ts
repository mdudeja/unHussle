import { ProgressStatus, type TaskListItem } from 'unhussle/frontend'
import type { Stage, StageStatus } from './boards'

type Task = Pick<TaskListItem, 'status' | 'custom_data' | 'title'>
type Changes = {
  title: string
  status?: StageStatus
  custom_data: { kanban: { stage: string } }
}

/** The stage status a task shows under; `null` when the board hides it. */
export function boardStatus(task: Task): StageStatus | null {
  switch (task.status) {
    case ProgressStatus.PLANNED:
    case ProgressStatus.IN_PROGRESS:
    case ProgressStatus.COMPLETED:
      return task.status
    case ProgressStatus.PAUSED:
      return ProgressStatus.IN_PROGRESS
    default:
      return null
  }
}

/** The task's column: its saved stage, else the first stage of its status. */
export function columnFor(task: Task, stages: Stage[]) {
  const status = boardStatus(task)
  if (!status) return -1
  const saved = (task.custom_data?.kanban as { stage?: unknown } | undefined)
    ?.stage
  const named = stages.findIndex(
    (stage) => stage.name === saved && stage.status === status,
  )
  return named >= 0
    ? named
    : stages.findIndex((stage) => stage.status === status)
}

/**
 * Saves the stage under Kanban's own key; the server merges it into the rest.
 * Changes the status only when the stage needs another one.
 */
export function moveChanges(task: Task, stage: Stage): Changes {
  const stageNameRegex = /^\s*\[.*?\]\s*/
  const hasStageInTitle = stageNameRegex.test(task.title)
  const originalTitle = hasStageInTitle
    ? task.title.replace(stageNameRegex, '')
    : task.title
  const newTitle = `[${stage.name}] ${originalTitle}`
  const changes = {
    title: stage.status === ProgressStatus.COMPLETED ? originalTitle : newTitle,
    custom_data: { kanban: { stage: stage.name } },
  }
  return boardStatus(task) === stage.status
    ? changes
    : { ...changes, status: stage.status }
}

const firstStage = (stages: Stage[], status: StageStatus) => {
  const stage = stages.find((candidate) => candidate.status === status)
  if (!stage) throw new Error(`The board has no ${status} stage`)
  return stage
}

/** A planned task moves to the first in-progress stage; others keep theirs. */
export function startChanges(task: Task, stages: Stage[]): Changes {
  const current = stages[columnFor(task, stages)]
  const stage =
    current?.status === ProgressStatus.IN_PROGRESS
      ? current
      : firstStage(stages, ProgressStatus.IN_PROGRESS)
  return { ...moveChanges(task, stage), status: ProgressStatus.IN_PROGRESS }
}

export const completeChanges = (task: Task, stages: Stage[]) =>
  moveChanges(task, firstStage(stages, ProgressStatus.COMPLETED))
