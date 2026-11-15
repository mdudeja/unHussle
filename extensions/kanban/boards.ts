import { ProgressStatus } from 'unhussle/frontend'

export const STAGE_STATUSES = [
  ProgressStatus.PLANNED,
  ProgressStatus.IN_PROGRESS,
  ProgressStatus.COMPLETED,
] as const
export type StageStatus = (typeof STAGE_STATUSES)[number]

export const STATUS_LABELS: Record<StageStatus, string> = {
  [ProgressStatus.PLANNED]: 'Planned',
  [ProgressStatus.IN_PROGRESS]: 'In progress',
  [ProgressStatus.COMPLETED]: 'Completed',
}

export const SOURCE_KINDS = ['projects', 'areas', 'goals', 'tags'] as const
export type SourceKind = (typeof SOURCE_KINDS)[number]

export type Stage = { name: string; status: StageStatus }
/** `title` is kept so the form can show the source without loading it. */
export type BoardSource = { kind: SourceKind; id: string; title: string }
export type Board = {
  id: string
  name: string
  sources: BoardSource[]
  stages: Stage[]
}

export const DEFAULT_STAGES: Stage[] = STAGE_STATUSES.map((status) => ({
  name: STATUS_LABELS[status],
  status,
}))

export type BoardErrors = {
  name?: string
  sources?: string
  stages?: string
  /** One message per stage row, in order. */
  stageNames: (string | undefined)[]
}

export function boardErrors(board: Board): BoardErrors {
  const names = board.stages.map((stage) => stage.name.trim().toLowerCase())
  const missing = STAGE_STATUSES.filter(
    (status) => !board.stages.some((stage) => stage.status === status),
  )
  return {
    name: board.name.trim() ? undefined : 'Enter a board name.',
    sources: board.sources.length
      ? undefined
      : 'Pick at least one project, area, goal or tag.',
    stages: missing.length
      ? `Add a stage for: ${missing.map((status) => STATUS_LABELS[status]).join(', ')}.`
      : undefined,
    stageNames: names.map((name, index) =>
      !name
        ? 'Enter a stage name.'
        : names.indexOf(name) !== index
          ? 'Use a different name for each stage.'
          : undefined,
    ),
  }
}

export const hasErrors = (errors: BoardErrors) =>
  Boolean(
    errors.name ||
    errors.sources ||
    errors.stages ||
    errors.stageNames.some(Boolean),
  )

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isBoard = (value: unknown): value is Board =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  Array.isArray(value.sources) &&
  value.sources.every(
    (source) =>
      isRecord(source) &&
      SOURCE_KINDS.includes(source.kind as SourceKind) &&
      typeof source.id === 'string' &&
      typeof source.title === 'string',
  ) &&
  Array.isArray(value.stages) &&
  value.stages.every(
    (stage) =>
      isRecord(stage) &&
      typeof stage.name === 'string' &&
      STAGE_STATUSES.includes(stage.status as StageStatus),
  )

/** Saved boards; throws when the saved value is not a list of boards. */
export function parseBoards(value: unknown): Board[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every(isBoard))
    throw new Error('Saved boards are not in the expected format')
  return value
}
